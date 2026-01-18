# Admin Panel Walkthrough & Verification Guide

This document outlines the steps to verify the new Admin Panel features, including Student Management, Profile Viewing, and Global Bounties.

## 1. Login as Admin
1.  Navigate to the login page (`/login`).
2.  Enter the following credentials:
    *   **Email:** `admin@admin.com`
    *   **Password:** `admin123`
3.  Click "Sign In".
4.  **Verify**: You should be redirected to the **Professor's Dashboard** (`/admin/dashboard`).

## 2. Verify Student Management (User List)
1.  look for the **Users Icon** (👥) in the top navigation bar (header).
2.  Click the icon.
3.  **Verify**: A modal titled **"Student Management"** should open.
4.  **Check Data**: Confirm you see a table listing registered students.
    *   Are the columns for **Level**, **Bloom Score**, and **Active Bounties** populated? (e.g., Lvl 1, Score 3.5).

## 3. Verify Profile View (Read-Only)
1.  In the "Student Management" list, find a student row.
2.  Click the **Eye Icon** (👁️) in the "Actions" column.
3.  **Verify**: A large modal should open displaying the **Full Profile Page** for that specific student.
    *   Confirm you see their specific **Skill Tree**.
    *   Confirm you see their **Learning Credits** and **Active Bounties**.
4.  Close the modal to return to the dashboard.

## 4. Verify Global Bounty Creation
1.  Click the **Target Icon** (🎯) in the top navigation bar.
2.  **Verify**: A modal titled **"Create Global Bounty"** opens.
3.  Fill in the form:
    *   **Topic**: "System Design"
    *   **Question**: "Explain the CAP theorem."
    *   **Difficulty**: "Hard"
    *   **Reward**: "100"
4.  Click **"Broadcast Bounty"**.
5.  **Verify**: A success message toast appears: *"Global Bounty Sent to All Users!"*.

## 5. Verify Bounty Receipt (Student View)
1.  **Logout** from the Admin account (use the "Logout Admin" button).
2.  Log in as a regular student (e.g., `user@example.com` or create a new account).
3.  Navigate to your **Profile Page** (click Profile icon -> Profile).
4.  Look at the **"Active Challenges"** (Bounty Board) section.
5.  **Verify**: The bounty you just created ("Explain the CAP theorem") should be visible in the list.
6.  (Optional) Click **"Claim Reward"** to verify you receive the 100 XP.
