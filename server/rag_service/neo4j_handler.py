# server/rag_service/neo4j_handler.py

import logging
from neo4j import GraphDatabase, exceptions as neo4j_exceptions
import config

logger = logging.getLogger(__name__)

# --- Neo4j Driver Management (No changes here) ---
_neo4j_driver = None
def init_driver():
    global _neo4j_driver
    if _neo4j_driver is not None:
        try:
            _neo4j_driver.verify_connectivity()
            try:
                with _neo4j_driver.session(database=config.NEO4J_DATABASE) as session:
                    session.execute_write(_create_fulltext_index_if_not_exists)
            except Exception as e:
                logger.warning(f"Neo4j: Could not execute index creation during init_driver (non-fatal if already exists): {e}")
            return # Driver already initialized and healthy, index check done
        except Exception:
            if _neo4j_driver: _neo4j_driver.close()
            _neo4j_driver = None # Reset if not healthy
    try:
        _neo4j_driver = GraphDatabase.driver(config.NEO4J_URI, auth=(config.NEO4J_USERNAME, config.NEO4J_PASSWORD))
        _neo4j_driver.verify_connectivity()
        logger.info(f"Neo4j driver initialized. Connected to: {config.NEO4J_URI}")
        
        with _neo4j_driver.session(database=config.NEO4J_DATABASE) as session:
            session.execute_write(_create_fulltext_index_if_not_exists)

    except Exception as e:
        logger.critical(f"Failed to initialize Neo4j driver: {e}", exc_info=True)
        _neo4j_driver = None
def get_driver_instance():
    if _neo4j_driver is None: init_driver()
    if _neo4j_driver is None: raise ConnectionError("Neo4j driver is not available.")
    return _neo4j_driver
def close_driver():
    global _neo4j_driver
    if _neo4j_driver: _neo4j_driver.close(); _neo4j_driver = None
def check_neo4j_connectivity():
    try: get_driver_instance().verify_connectivity(); return True, "connected"
    except Exception as e: return False, f"disconnected: {e}"
def _execute_read_tx(tx_function, *args, **kwargs):
    with get_driver_instance().session(database=config.NEO4J_DATABASE) as session:
        return session.execute_read(tx_function, *args, **kwargs)
def _execute_write_tx(tx_function, *args, **kwargs):
    with get_driver_instance().session(database=config.NEO4J_DATABASE) as session:
        return session.execute_write(tx_function, *args, **kwargs)
def _create_fulltext_index_if_not_exists(tx):
    index_name = "node_search_index"
    
    result = tx.run(f"SHOW FULLTEXT INDEXES WHERE name = '{index_name}'")
    if result.single():
        logger.info(f"Neo4j: Full-text index '{index_name}' already exists.")
        return

    create_query = (
        f"CREATE FULLTEXT INDEX {index_name} "
        f"FOR (n:KnowledgeNode) ON EACH [n.nodeId, n.description] "
        f"OPTIONS {{indexConfig: {{`fulltext.analyzer`: 'standard', `fulltext.eventually_consistent`: true}}}}"
    )
    try:
        tx.run(create_query)
        logger.info(f"Neo4j: Successfully created full-text index '{index_name}'.")
    except Exception as e:
        # Handle cases where index might have been created by another process concurrently
        if "already exists" in str(e):
            logger.info(f"Neo4j: Full-text index '{index_name}' concurrently created or already exists (race condition). Proceeding.")
        else:
            logger.error(f"Neo4j: Failed to create full-text index '{index_name}': {e}", exc_info=True)
            raise #
            
def _delete_kg_transactional(tx, user_id, document_name):
    query = "MATCH (n:KnowledgeNode {userId: $userId, documentName: $documentName}) DETACH DELETE n"
    tx.run(query, userId=user_id, documentName=document_name)
    return True
def _add_nodes_transactional(tx, nodes_param, user_id, document_name):
    processed_nodes = [
        {"id": n["id"].strip(), "type": n.get("type", "concept"), "description": n.get("description", ""), "llm_parent_id": n.get("parent")}
        for n in nodes_param if isinstance(n.get("id"), str) and n.get("id").strip()
    ]
    if not processed_nodes: return 0
    query = """
    UNWIND $nodes_data as props MERGE (n:KnowledgeNode {nodeId: props.id, userId: $userId, documentName: $documentName})
    SET n += props, n.userId = $userId, n.documentName = $documentName RETURN count(n)
    """
    result = tx.run(query, nodes_data=processed_nodes, userId=user_id, documentName=document_name)
    return result.single()[0] if result.peek() else 0
def _add_edges_transactional(tx, edges_param, user_id, document_name):
    valid_edges = [
        {"from": e["from"].strip(), "to": e["to"].strip(), "relationship": e["relationship"].strip().upper().replace(" ", "_")}
        for e in edges_param if isinstance(e.get("from"), str) and e["from"].strip() and isinstance(e.get("to"), str) and e["to"].strip() and isinstance(e.get("relationship"), str) and e["relationship"].strip()
    ]
    if not valid_edges: return 0
    query = """
    UNWIND $edges_data as edge
    MATCH (startNode:KnowledgeNode {nodeId: edge.from, userId: $userId, documentName: $documentName})
    MATCH (endNode:KnowledgeNode {nodeId: edge.to, userId: $userId, documentName: $documentName})
    MERGE (startNode)-[r:RELATED_TO {type: edge.relationship}]->(endNode) RETURN count(r)
    """
    result = tx.run(query, edges_data=valid_edges, userId=user_id, documentName=document_name)
    return result.single()[0] if result.peek() else 0


def _search_kg_transactional(tx, user_id, document_name, query_text):
    logger.info(f"Neo4j TX: Searching KG for user '{user_id}', doc '{document_name}' with query: '{query_text[:50]}...'")
    
    query = """
    CALL db.index.fulltext.queryNodes("node_search_index", $query_text) YIELD node, score
    WHERE node.userId = $userId AND toLower(node.documentName) = toLower($documentName)
    WITH node, score ORDER BY score DESC LIMIT 5
    MATCH (node)-[r:RELATED_TO]-(neighbor)
    WHERE neighbor.userId = $userId AND toLower(neighbor.documentName) = toLower($documentName)
    RETURN node.nodeId AS nodeId, node.description AS description, 
           COLLECT(DISTINCT { relationship: r.type, neighborId: neighbor.nodeId }) AS relations
    """
    
    results = tx.run(query, userId=user_id, documentName=document_name, query_text=query_text)
    
    facts = []
    for record in results:
        fact = f"- Concept '{record['nodeId']}': {record['description']}"
        relations = [f"is '{rel['relationship']}' '{rel['neighborId']}'" for rel in record['relations'] if rel.get('relationship') and rel.get('neighborId')]
        if relations:
            fact += f" | It {', '.join(relations)}."
        facts.append(fact)
    # --- END OF FIX ---
        
    if not facts:
        return "No specific facts were found in the knowledge graph for this query."
        
    return "Facts from Knowledge Graph:\n" + "\n".join(facts)


def _get_kg_transactional(tx, user_id, document_name):
    logger.info(f"Neo4j TX: Retrieving FULL KG for visualization. User '{user_id}', Doc '{document_name}'")
    
    nodes_query = """
    MATCH (n:KnowledgeNode {userId: $userId}) WHERE toLower(n.documentName) = toLower($documentName)
    RETURN n.nodeId AS id, n.type AS type, n.description AS description, n.llm_parent_id AS parent
    """
    nodes_result = tx.run(nodes_query, userId=user_id, documentName=document_name)
    nodes_data = [dict(record) for record in nodes_result]

    edges_query = """
    MATCH (startNode:KnowledgeNode {userId: $userId})-[r:RELATED_TO]->(endNode:KnowledgeNode {userId: $userId})
    WHERE toLower(startNode.documentName) = toLower($documentName) AND toLower(endNode.documentName) = toLower($documentName)
    RETURN startNode.nodeId AS from, endNode.nodeId AS to, r.type AS relationship
    """
    edges_result = tx.run(edges_query, userId=user_id, documentName=document_name)
    edges_data = [dict(record) for record in edges_result]

    logger.info(f"Neo4j TX: Retrieved {len(nodes_data)} nodes and {len(edges_data)} edges for '{document_name}'.")
    return {"nodes": nodes_data, "edges": edges_data}


# --- Public Service Functions ---
def ingest_knowledge_graph(user_id: str, document_name: str, nodes: list, edges: list) -> dict:
    try:
        nodes_affected = _execute_write_tx(_add_nodes_transactional, nodes, user_id, document_name) if nodes else 0
        edges_affected = _execute_write_tx(_add_edges_transactional, edges, user_id, document_name) if edges else 0
        return {"success": True, "message": "KG ingested.", "nodes_affected": nodes_affected, "edges_affected": edges_affected}
    except Exception as e:
        logger.error(f"Error during KG ingestion for doc '{document_name}': {e}", exc_info=True)
        raise

def get_knowledge_graph(user_id: str, document_name: str) -> dict:
    try:
        kg_data = _execute_read_tx(_get_kg_transactional, user_id, document_name)
        if not kg_data or (not kg_data.get("nodes") and not kg_data.get("edges")):
            logger.info(f"No KG data found for user '{user_id}', document '{document_name}'.")
            return None
        return kg_data
    except Exception as e:
        logger.error(f"Error retrieving KG for doc '{document_name}': {e}", exc_info=True)
        raise

def delete_knowledge_graph(user_id: str, document_name: str) -> bool:
    try:
        return _execute_write_tx(_delete_kg_transactional, user_id, document_name)
    except Exception as e:
        logger.error(f"Error deleting KG for doc '{document_name}': {e}", exc_info=True)
        raise

def search_knowledge_graph(user_id: str, document_name: str, query_text: str) -> str:
    try:
        return _execute_read_tx(_search_kg_transactional, user_id, document_name, query_text)
    except Exception as e:
        logger.error(f"Error searching KG for doc '{document_name}', user '{user_id}': {e}", exc_info=True)
        return f"An error occurred while searching the knowledge graph: {e}"

# --- Study Plan Graph Functions ---

def _create_study_plan_transactional(tx, user_id, session_id, plan_items):
    logger.info(f"Creating Study Plan Graph. Items: {len(plan_items) if plan_items else 0}")
    if plan_items:
        logger.info(f"First Item: {plan_items[0]}")

    # Flatten checks
    if not plan_items: return False

    # 1. Create ALL nodes (Modules + Subtopics)
    # We will process them in a loop to handle the hierarchy
    
    # List to hold all node dicts for batch creation
    all_nodes = []
    
    # Store order relative to entire sequence for NEXT_TOPIC
    
    for i, module in enumerate(plan_items):
        # Create Module Node
        all_nodes.append({
            "sessionId": session_id,
            "topic": module["topic"],
            "description": module.get("description", ""),
            "status": module.get("status", "pending"),
            "order": i, # Top level order
            "type": "Lesson",
            "is_subtopic": False
        })
        
        if "subtopics" in module and module["subtopics"]:
            for j, sub in enumerate(module["subtopics"]):
                all_nodes.append({
                    "sessionId": session_id,
                    "topic": sub["topic"],
                    "description": sub.get("description", ""),
                    "status": sub.get("status", "pending"),
                    "order": i * 100 + j, # Composite order for simple sorting
                    "parent_topic": module["topic"], # Link back
                    "type": "Topic",
                    "is_subtopic": True
                })

    # Batch Create Nodes
    query_nodes = """
    UNWIND $nodes as node
    MERGE (p:PlanTopic {sessionId: $sessionId, topic: node.topic})
    SET p.userId = $userId, 
        p.description = node.description, 
        p.status = node.status, 
        p.order = toInteger(node.order),
        p.type = node.type,
        p.createdAt = timestamp()
    """
    tx.run(query_nodes, nodes=all_nodes, sessionId=session_id, userId=user_id)

    # 2. Create Hierarchical Relationships (Lesson CONTAINS Topic)
    query_contains = """
    UNWIND $nodes as node
    WITH node WHERE node.is_subtopic = true
    MATCH (parent:PlanTopic {sessionId: $sessionId, topic: node.parent_topic})
    MATCH (child:PlanTopic {sessionId: $sessionId, topic: node.topic})
    MERGE (parent)-[:CONTAINS]->(child)
    """
    tx.run(query_contains, nodes=all_nodes, sessionId=session_id, userId=user_id)

    # 3. Create Sequential Relationships (NEXT_TOPIC)
    # We sequence subtopics across the whole course? 
    # Or Lesson -> Lesson AND Topic -> Topic?
    # Let's do a simple linear sequence of ALL "Topic" (leaf) nodes for the learning path
    # And separate sequence for "Lesson" nodes.
    
    leaf_nodes = [n for n in all_nodes if n["is_subtopic"]]
    # If no subtopics (flat structure), use top level
    if not leaf_nodes: 
        leaf_nodes = [n for n in all_nodes]
        
    sorted_leaves = sorted(leaf_nodes, key=lambda x: x['order'])
    
    rels = []
    for i in range(len(sorted_leaves) - 1):
        rels.append({
            "from": sorted_leaves[i]['topic'],
            "to": sorted_leaves[i+1]['topic']
        })
        
    if rels:
        query_seq = """
        UNWIND $rels as rel
        MATCH (p1:PlanTopic {sessionId: $sessionId, topic: rel.from})
        MATCH (p2:PlanTopic {sessionId: $sessionId, topic: rel.to})
        MERGE (p1)-[:NEXT_TOPIC]->(p2)
        """
        tx.run(query_seq, rels=rels, sessionId=session_id)
        
    return True

def _update_plan_status_transactional(tx, user_id, session_id, topic_name, status):
    logger.info(f"Neo4j Update: Session={session_id}, Topic='{topic_name}', Status={status}")
    query = """
    MATCH (p:PlanTopic {sessionId: $sessionId, topic: $topic})
    WHERE p.userId = $userId
    SET p.status = $status, p.updatedAt = timestamp()
    RETURN p.topic, p.status
    """
    result = tx.run(query, sessionId=session_id, topic=topic_name, userId=user_id, status=status)
    record = result.single()
    if record:
        logger.info(f"Neo4j Update Success: {record[0]} -> {record[1]}")
        return {"topic": record[0], "status": record[1]}
    else:
        logger.warning(f"Neo4j Update Failed: Node not found for Topic='{topic_name}' in Session='{session_id}'")
        return None

def _get_study_plan_graph_transactional(tx, user_id, session_id):
    query = """
    MATCH (p:PlanTopic {sessionId: $sessionId})
    WHERE p.userId = $userId
    OPTIONAL MATCH (p)-[r:NEXT_TOPIC]->(next)
    RETURN p as node, r as rel, next as next_node
    ORDER BY p.order ASC
    """
    result = tx.run(query, sessionId=session_id, userId=user_id)
    
    nodes = {}
    edges = []
    
    for record in result:
        node = record["node"]
        node_data = {
            "topic": node["topic"],
            "description": node.get("description", ""),
            "status": node.get("status", "pending"),
            "order": node.get("order")
        }
        nodes[node["topic"]] = node_data
        
        if record["rel"] and record["next_node"]:
             edges.append({
                 "from": node["topic"],
                 "to": record["next_node"]["topic"],
                 "type": "NEXT_TOPIC"
             })
             
    # Return as lists
    return {"nodes": list(nodes.values()), "edges": edges}

def create_study_plan_graph(user_id: str, session_id: str, plan_items: list) -> bool:
    try:
        if not plan_items: return False
        return _execute_write_tx(_create_study_plan_transactional, user_id, session_id, plan_items)
    except Exception as e:
        logger.error(f"Error creating study plan graph for session '{session_id}': {e}", exc_info=True)
        raise

def update_plan_topic_status(user_id: str, session_id: str, topic_name: str, status: str) -> dict:
    try:
        return _execute_write_tx(_update_plan_status_transactional, user_id, session_id, topic_name, status)
    except Exception as e:
        logger.error(f"Error updating plan status for topic '{topic_name}' in session '{session_id}': {e}", exc_info=True)
        raise

def get_study_plan_graph(user_id: str, session_id: str) -> dict:
    try:
        return _execute_read_tx(_get_study_plan_graph_transactional, user_id, session_id)
    except Exception as e:
        logger.error(f"Error retrieving study plan graph for session '{session_id}': {e}", exc_info=True)
        raise
