# Project: speech-whiteboard-ai
# Architecture: Microservices (4 backends in services/ + 1 frontend) + Docker + Shell setup

```bash
project speech-whiteboard-ai
├── frontend/                  # Next.js + React + Konva + Web Speech API
│   ├── pages/
│   ├── components/
│   ├── utils/
│   ├── services/              # WebSocket + API clients
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── services/
│   ├── gateway-api/           # Express app: auth, route controller
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── canvas/                # WebSocket + canvas commands handler
│   │   ├── ws/
│   │   ├── handlers/
│   │   ├── utils/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── command-parser/        # spaCy/GPT command parser
│   │   ├── app.py
│   │   ├── prompts/
│   │   ├── models/
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── config.json
│   │
│   ├── session-service/       # Save/load sessions to Firestore
│   │   ├── firestore/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── Dockerfile
│   │   └── package.json
│
├── scripts/
│   ├── install.sh            # Install all dependencies
│   ├── run.sh                # Start each service in new terminals
│   └── .env
│
├── docs/
│   └── architecture/
│       ├── architecture.md    # This file - system architecture
│       └── ROADMAP.md        # Implementation roadmap
│
├── docker-compose.yml        # Compose for all services
└── README.md
```