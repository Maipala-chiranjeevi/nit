# Feedback Feature Walkthrough

This guide details how to verify the new user feedback system, covering both the student submission flow and the admin review process.

## 1. User Feedback Submission (Student View)

**Goal**: Verify a user can successfully submit feedback, a bug report, or a feature request.

1.  **Login** to the application as a **Regular User**.
2.  Navigate to the **Profile Page** by clicking your avatar or name in the sidebar/navigation.
3.  **Locate the Button**: Look for the **"Feedback"** button in the top header area (top-right corner).
4.  **Open Modal**: Click the button. A "Send Feedback" modal should appear.
5.  **Fill the Form**:
    *   **Select Type**: Choose *General*, *Bug*, or *Feature*. Note how the icon highlights.
    *   **Enter Message**: Type a test message (e.g., "Testing feedback submission").
6.  **Submit**: Click the **Submit Feedback** button.
7.  **Verify**:
    *   A success "toast" notification should appear ("Thank you for your feedback!").
    *   The modal should close automatically.

## 2. Admin Feedback Review (Professor View)

**Goal**: Verify the admin can view the submitted feedback.

1.  **Login** as an **Admin**.
    *   Email: `admin@admin.com`
    *   Password: `admin123`
2.  Navigate to the **Admin Dashboard** (`/admin`).
3.  **Locate the Icon**: In the top dashboard header, find the **Feedback Manager** icon button (looks like a Message Square bubble), located near the Settings/Cog icon.
4.  **Open Manager**: Click the icon to open the **User Feedback** modal.
5.  **Verify Content**:
    *   Check for the feedback item you just created.
    *   **User Info**: Ensure the username and email match the sender.
    *   **Type**: Verify the icon matches the type (Bug/Feature/General).
    *   **Message**: confirm the text matches properly.
6.  **Check Status**: The item should display a "new" status badge.

## Technical Summary of Changes

### Backend
*   **New Model**: `Feedback` (`server/models/Feedback.js`) - Stores user, type, message, status.
*   **New Routes**: `/api/feedback` (`server/routes/feedback.js`)
    *   `POST /` - Secured endpoint for submission.
    *   `GET /` - Admin-protected endpoint for retrieval.

### Frontend
*   **Profile Page**: Added `FeedbackModal` trigger button.
*   **Admin Dashboard**: Added `FeedbackManager` modal trigger.
*   **Components**:
    *   `FeedbackModal.jsx`: Form for users.
    *   `FeedbackManager.jsx`: List view for admins.
*   **Services**: Updated `api.js` and `adminApi.js`.
