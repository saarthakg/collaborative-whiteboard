# Collaborative Whiteboard

A real-time collaborative whiteboard: multiple users on the same canvas, editing together. Built with React, FastAPI, PostgreSQL, and WebSockets.

## Getting started

1. Clone the repository and open the project directory:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```
2. Follow `SETUP.md` to run the app with Docker Compose or locally.

## Use case

The whiteboard targets synchronous design reviews: a small group (typically 2–5 people) on a call, using the canvas as a shared scratchpad.

- Each user has an account and can create canvases or be invited to others'.
- Several people often edit at once—including the same objects—as they explore alternatives or align in real time.
- A typical session runs 30–90 minutes.
- Teams sometimes return to a canvas later to recall what was decided.

## Features

- User accounts (signup, login, logout)
- Create a canvas, open an existing canvas
- Invite other users to a canvas (by username or email—a simple mechanism is fine)
- Shapes: rectangle, ellipse, line, text
- Select, move, resize, delete, change color
- Undo / redo
- See other users' cursors
- Canvas state persists across sessions

## Out of scope

These are intentionally not part of this version:

- Collaborative text editing within text elements (treating a text update as a single operation is fine)
- Granular permissions (viewer/editor/owner roles, share-with-link, etc.)
- Rich text editing, images, or file uploads
- Canvas zoom, pan, or infinite canvas
- Export (PNG, SVG, PDF)
- Version history or named snapshots
- Mobile or touch support

## Scaffold

The repo includes a minimal scaffold—frontend, backend, and database wired together—with room to extend. You can restructure the scaffold; the intended stack is React, FastAPI, and PostgreSQL.
