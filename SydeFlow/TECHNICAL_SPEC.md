
# Parametric CAD-to-Commerce Platform
## Technical Specification (Agent-Oriented)


## 1. System Objective

Build a multi-tenant SaaS platform that:
- Connects Autodesk Inventor Automation (APS) to web applications
- Exposes controlled parametric CAD inputs
- Regenerates geometry on demand
- Serves manufacturable outputs via API

---

## 2. High-Level Architecture

```

[ Web Client / Embed SDK ]
|
| REST / WebSocket
v
[ Node.js Control Plane ]
|
| Job Queue (async)
v
[ Python CAD Worker ]
|
| Autodesk Platform Services (APS)
v
[ Storage + Outputs ]

````

---

## 3. Core Services

### 3.1 Node.js Control Plane

**Responsibilities**
- Authentication (multi-tenant)
- Product & model metadata
- Parameter schemas
- Pricing logic (rule-based)
- Job orchestration
- Public APIs

**Tech Stack**
- Node.js (TypeScript)
- Fastify
- PostgreSQL (or CockroachDB)
- Redis (queue + cache)
- BullMQ (job queue)
- JWT-based auth

---

### 3.2 Python CAD Worker

**Responsibilities**
- APS authentication
- Inventor Automation execution
- Parameter injection
- Geometry regeneration
- Export generation
- Status reporting

**Tech Stack**
- Python 3.10+
- APS REST API / SDK
- iLogic scripts
- Async polling

---

### 3.3 Autodesk Platform Services (APS)

**Used APIs**
- Inventor Automation API
- Model Derivative API

**Functions**
- Headless Inventor execution
- Parameter-driven regeneration
- Export to:
  - STEP
  - STL
  - DXF
  - GLTF (preview)

**Constraints**
- No persistent CAD state
- Job-based execution only

---

## 4. Data Flow

### 4.1 Model Upload Flow

1. Client uploads `.ipt` / `.iam`
2. Node service stores file in object storage
3. Node enqueues parameter extraction job
4. Python worker:
   - Runs Inventor
   - Extracts user parameters
   - Returns parameter schema (JSON)

---

### 4.2 Configuration Update Flow

1. Client submits parameter values
2. Node validates against schema
3. Node computes price
4. Node enqueues regen job
5. Python worker:
   - Applies parameters
   - Regenerates model
   - Exports outputs
6. Outputs stored and indexed
7. Client notified via webhook or polling

---

## 5. Parameter Schema

```json
{
  "parameters": {
    "length": {
      "type": "number",
      "unit": "mm",
      "min": 300,
      "max": 2400,
      "editable": true
    },
    "material": {
      "type": "enum",
      "values": ["Aluminium", "Steel", "Birch_Ply"],
      "editable": true
    }
  }
}
````

---

## 6. API Specification (Control Plane)

### 6.1 Model APIs

```
POST   /models/upload
GET    /models/{id}
GET    /models/{id}/parameters
```

---

### 6.2 Configuration APIs

```
POST   /config/price
POST   /config/generate
GET    /config/status/{jobId}
```

---

### 6.3 Output APIs

```
GET    /outputs/{jobId}
GET    /outputs/{jobId}/{format}
```

---

## 7. Job Queue Contract

### Job Payload (Node → Python)

```json
{
  "job_id": "uuid",
  "model_id": "uuid",
  "parameters": {
    "length": 1200,
    "material": "Aluminium"
  },
  "outputs": ["STEP", "GLTF"]
}
```

---

### Job Result (Python → Node)

```json
{
  "job_id": "uuid",
  "status": "success",
  "files": {
    "STEP": "s3://outputs/step/file.step",
    "GLTF": "s3://outputs/gltf/file.gltf"
  }
}
```

---

## 8. Pricing Engine (Deterministic)

* Rule-based
* No ML dependency

```txt
price =
(material_cost * volume)
+ machining_cost(length, tolerance)
+ margin
```

---

## 9. Storage Layout

```
/models/{tenant}/{model_id}/source.ipt
/outputs/{tenant}/{job_id}/
  ├── model.step
  ├── preview.gltf
  └── drawing.pdf
```

---

## 10. Security Constraints

* Source CAD never downloadable
* Signed URLs for outputs
* Per-tenant isolation
* Rate-limited regen jobs

---

## 11. Non-Goals

* Real-time CAD streaming
* Mobile-native clients
* ERP / PLM integration
* Non-Inventor CAD support

---

## 12. Deployment Constraints

* Dockerized services
* Single-region deployment
* Horizontal scaling for CAD workers only
* Stateless Node services

---

## 13. Build Order (Strict)

1. APS Inventor automation script
2. Parameter extraction
3. Regen job execution
4. Node API façade
5. Storage & output serving
6. Minimal embed client

---
