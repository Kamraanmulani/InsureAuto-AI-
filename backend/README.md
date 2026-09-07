# Backend API Documentation

## Overview
Node.js Express backend for Insurance Claim Validation system with MongoDB persistence and ML backend integration.

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start MongoDB
Ensure MongoDB is running on `localhost:27017`

### 3. Start Backend
```bash
npm run dev  # Development with nodemon
npm start    # Production
```

## API Endpoints

### Health Check
- **GET** `/health` - Check API and MongoDB status

### Authentication
- **POST** `/api/auth/register` - Register new assessor
- **POST** `/api/auth/login` - Login

### Claims
- **POST** `/api/claims/analyze` - Submit claim for analysis
- **GET** `/api/claims` - Get all claims (with filters)
- **GET** `/api/claims/:jobId` - Get single claim
- **PATCH** `/api/claims/:jobId/status` - Update claim status
- **PATCH** `/api/claims/:jobId/override` - Assessor override decision
- **GET** `/api/claims/stats/summary` - Get statistics

## Environment Variables
See `.env` file for configuration:
- PORT
- MONGODB_URI
- ML_API_URL
- JWT_SECRET
- NODE_ENV

## Testing
Run test script:
```bash
# Bash
bash test_backend.sh

# PowerShell
.\test_backend.ps1
```
