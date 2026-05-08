# PRODUCT-SPEC: Doc

## Overview

**App Name:** Doc
**Domain:** Document Management
**Target User:** All teams — cross-cutting utility

## Core Entities

### Folder
```
Folder
├── id: UUID (PK)
├── name: str (required)
├── parent_id: UUID (FK → Folder, self-referential, ondelete=CASCADE, optional)
├── path: str (optional) — computed path
├── created_at: datetime
└── updated_at: datetime
```

### Document
```
Document
├── id: UUID (PK)
├── title: str (required)
├── content: text (optional)
├── folder_id: UUID (FK → Folder, ondelete=SET NULL, optional)
├── created_by: str (optional)
├── version: int (default 1)
├── tags: array[str] (optional)
├── created_at: datetime
└── updated_at: datetime
```

### ShareLink
```
ShareLink
├── id: UUID (PK)
├── document_id: UUID (FK → Document, ondelete=CASCADE)
├── token: str (unique, required)
├── expires_at: datetime (optional)
├── permission: enum ["view", "edit"] (default: "view")
├── created_at: datetime
└── updated_at: datetime
```

## User Stories / Screens

### Screen 1: Dashboard
- Summary cards: total documents, folders, shared links, recent edits
- Recent documents list
- Quick actions (new doc, new folder)

### Screen 2: Document List
- Table/card view with pagination, search by title/content
- Tag filters
- Folder sidebar navigation
- "Add Document" modal/form

### Screen 3: Document Detail / Editor
- Title editor
- Content textarea (rich text placeholder)
- Version number display
- Tags editor
- Move to folder dropdown
- Share button (generates link)
- Delete button

### Screen 4: Folder View
- Breadcrumb navigation
- Subfolders list
- Documents in folder
- "Add Subfolder" button

### Screen 5: Shared Links
- Table of active share links
- Copy link button
- Revoke link button
- Expiration info

## API Endpoints

- `GET /api/v1/folders` — list folders
- `POST /api/v1/folders` — create folder
- `GET /api/v1/folders/{id}` — get folder
- `PATCH /api/v1/folders/{id}` — update folder
- `DELETE /api/v1/folders/{id}` — delete folder

- `GET /api/v1/documents` — list documents
- `POST /api/v1/documents` — create document
- `GET /api/v1/documents/{id}` — get document
- `PATCH /api/v1/documents/{id}` — update document
- `DELETE /api/v1/documents/{id}` — delete document

- `GET /api/v1/share-links` — list share links
- `POST /api/v1/share-links` — create share link
- `DELETE /api/v1/share-links/{id}` — revoke share link
