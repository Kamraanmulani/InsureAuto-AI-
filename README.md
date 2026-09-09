# InsureAuto AI

> AI-Assisted Motor Insurance Claim Assessment & Fraud Detection Platform

InsureAuto AI is an insurance claims operations platform that combines computer vision, vision-language modeling (VLM), and temporal anti-fraud heuristics into an assessor workspace. The system ingests physical vehicle damage evidence—both single damage photographs and walk-around inspection videos—to quantify damage severity, cross-verify claimant descriptions, detect digital tampering and duplicate submissions, and provide transparent adjudication recommendations.

---

## Key Capabilities

- **Walk-Around Video Inspection**: Automated frame extraction, motion blur rejection, damage salience ranking, and primary/secondary angle selection.
- **Physical Damage Quantification**: YOLOv10 object detection localizing vehicle components and damaged regions with bounding boxes.
- **Vision-Language Reasoning**: LLaVA multi-modal inference providing damage severity grading and repair vs. replacement analysis.
- **Anti-Fraud & Integrity Verification**:
  - Perceptual image and video hashing to detect recycled claims and mirrored footage.
  - Cross-policy reuse alerts across distinct insured accounts.
  - Video stream and EXIF metadata validation to flag digital editing and tampering.
- **Text-Visual Consistency Analysis**: Corroborates claimant written narratives against visual damage features.
- **Assessor Workspace**:
  - Claims operational queue with triage tabs (Needs Review, High Risk, Processing, Approved, Rejected, Closed).
  - Two-column investigation workspace with high-resolution evidence viewers and salience timelines.
  - Human decision workflow (Approve, Request Information, Reject, and Manual Override with mandatory audit justification).
  - Customer directory, policy registry, and honest operational reports (no fabricated metrics).
  - Isolated administrative system health diagnostics.

---

## System Architecture

```
                      +-----------------------------+
                      |     React 19 Assessor UI    |
                      |         (Port 3000)         |
                      +--------------+--------------+
                                     |
                                     | REST / Multipart
                                     v
                      +-----------------------------+
                      |     Node.js / Express API   |
                      |         (Port 5000)         |
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
+---------------------------+                 +---------------------------+
|    MongoDB Persistence    |                 |   Python FastAPI Engine   |
|   (Claims, Users, Audit)  |                 |         (Port 8000)       |
+---------------------------+                 +-------------+-------------+
                                                            |
                                      +---------------------+---------------------+
                                      |                     |                     |
                                      v                     v                     v
                               +-------------+       +-------------+       +-------------+
                               |   YOLOv10   |       |  LLaVA VLM  |       | Anti-Fraud  |
                               |  Detections |       |  Reasoning  |       |  & Hashing  |
                               +-------------+       +-------------+       +-------------+
```

---

## Repository Structure

```
InsureAuto-AI/
├── backend/                  # Node.js Express API & authentication service
│   ├── src/
│   │   ├── config/           # Database connections (MongoDB/Mongoose)
│   │   ├── controllers/      # Auth and claim HTTP controllers
│   │   ├── middleware/       # JWT auth and Multer file upload handlers
│   │   ├── models/           # Claim and User data schemas
│   │   ├── routes/           # REST endpoints (/api/claims, /api/auth)
│   │   ├── services/         # Orchestration and ML proxy service
│   │   └── server.js         # Backend entry point
│   ├── package.json
│   └── .gitignore
│
├── frontend/                 # React 19 desktop-first assessor application
│   ├── src/
│   │   ├── components/       # Dashboard, claim detail, intake, navbar
│   │   ├── layouts/          # Top navigation and toast layout
│   │   ├── pages/            # Dashboard, Claims, Customers, Policies, Reports, Settings
│   │   ├── routes/           # Client-side route declarations
│   │   ├── services/         # Axios API client
│   │   └── index.css         # Styling with Tailwind CSS and toast styles
│   ├── package.json
│   └── .gitignore
│
├── ml-backend/               # Python AI inference & fraud analysis service
│   ├── app/
│   │   ├── api/              # FastAPI route controllers
│   │   ├── models/           # YOLOv10 detector, LLaVA analyzer, fraud detector
│   │   ├── services/         # Preprocessing, metadata extractor, scoring engine
│   │   └── utils/            # Video processor and image utilities
│   ├── data/                 # Hash registries and storage
│   ├── main.py               # ML service entry point
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile
│   └── .gitignore
│
├── .env.template             # Environment variables template
├── .gitignore                # Root git exclusion configuration
├── docker-compose.yml        # Multi-container orchestration
└── README.md                 # Project documentation
```

---

## Prerequisites

- **Node.js**: v18.x or v20.x
- **Python**: 3.10 or 3.11
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) or MongoDB Atlas
- **FFmpeg**: System package required for video keyframe extraction and audio processing
- **Git**

---

## Environment Setup

Copy `.env.template` to `.env` in the root and in the individual service directories as required:

### Root / Global `.env.template`
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/insurance_claims
JWT_SECRET=your_super_secret_jwt_key_here
ML_SERVICE_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ML_API_URL=http://localhost:8000
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
```

---

## Running the Application Manually

Start each service in a separate terminal window:

### 1. Python ML Service (Port 8000)

```bash
cd ml-backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the ML inference service
python main.py
```

The ML service will be accessible at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 2. Node.js Backend Service (Port 5000)

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
```

The API service will be accessible at `http://localhost:5000`.

### 3. Frontend Application (Port 3000)

```bash
cd frontend

# Install dependencies
npm install

# Start React dev server
npm run dev
```

The assessor workspace will be available in your browser at `http://localhost:3000`.

---

## Running via Docker Compose

To start all services together with local MongoDB and Qdrant:

```bash
docker-compose up --build
```

---

## API Endpoints Reference

### Core Express Backend (`http://localhost:5000/api`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/claims/analyze` | Ingest physical evidence (photo or walk-around video) and run ML analysis |
| `GET` | `/claims` | List claims with optional filtering by recommendation, status, or date |
| `GET` | `/claims/:jobId` | Retrieve complete claim details, AI breakdown, and audit trail |
| `PATCH` | `/claims/:jobId/status` | Update claim workflow status (`APPROVED`, `REJECTED`, `REVIEW_REQUIRED`) |
| `PATCH` | `/claims/:jobId/override` | Record assessor manual override with justification rationale |
| `GET` | `/claims/stats/summary` | Retrieve aggregate claims volume and status distribution |
| `POST` | `/auth/login` | Assessor authentication |
| `POST` | `/auth/register` | Register an assessor account |

### Python ML Backend (`http://localhost:8000`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/analyze-claim` | Analyze single vehicle damage photograph |
| `POST` | `/api/analyze-video-claim` | Analyze walk-around inspection video with multi-frame salience extraction |
| `GET` | `/api/annotated-image/{job_id}` | Retrieve primary keyframe with YOLO bounding boxes |
| `GET` | `/api/annotated-keyframe/{job_id}` | Retrieve ranked candidate keyframes (`primary`, `secondary`, `composite`) |
| `GET` | `/health` | Service health check |

---

## Workspace Navigation

- **Overview (`/dashboard`)**: Summary triage row, priority attention table, outcome distribution, and activity feed.
- **Claims Queue (`/claims`)**: Primary operational table with filters for *Needs Review*, *High Risk*, *Processing*, *Approved*, and *Rejected*.
- **Claim Detail (`/claims/:jobId`)**: Evidence viewer, damage regions, fraud indicators, text consistency, and human override actions.
- **New Claim (`/submit`)**: Media upload form supporting MP4/MOV walk-around video and JPG/PNG damage photos.
- **Customers (`/customers`)**: Directory of insured drivers and claim history drawer.
- **Policies (`/policies`)**: Operational policy registry with coverage packages, deductibles, and associated claims.
- **Reports (`/reports`)**: Objective operational metrics without fabricated agreement percentages.
- **Settings (`/settings`)**: Assessor profile preferences with isolated administrative system health diagnostics.
