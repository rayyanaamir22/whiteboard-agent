# Gateway API

The Gateway API serves as the central orchestration layer for the speech-whiteboard-ai microservices architecture. It provides a single entry point for the frontend to interact with all backend services.

## Features

- **Authentication**: JWT-based user authentication and session management
- **Service Proxy**: Routes requests to appropriate microservices
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Health Checks**: Health monitoring for all services
- **CORS Support**: Cross-origin resource sharing enabled
- **Security**: Helmet.js for security headers

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

Create a `.env` file in the gateway-api directory:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
CANVAS_SERVICE_URL=http://localhost:8081
COMMAND_PARSER_URL=http://localhost:5000
SESSION_SERVICE_URL=http://localhost:3002
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/refresh` - Refresh JWT token

### Canvas Operations
- `POST /api/canvas/command` - Execute canvas command
- `GET /api/canvas/state` - Get canvas state
- `POST /api/canvas/clear` - Clear canvas
- `GET /api/canvas/info` - Get canvas service info

### Command Parsing
- `POST /api/command/parse` - Parse speech to commands
- `GET /api/command/available` - Get available commands
- `GET /api/command/health` - Health check
- `GET /api/command/info` - Get command parser info

### Session Management
- `POST /api/session/save` - Save whiteboard session
- `GET /api/session/load/:sessionId` - Load session
- `GET /api/session/list` - List user sessions
- `DELETE /api/session/delete/:sessionId` - Delete session
- `GET /api/session/info` - Get session service info

### System
- `GET /health` - Gateway health check
- `GET /` - API information

## Service Communication

The Gateway API communicates with other services:

1. **Canvas Service** (port 8081): Handles canvas operations and WebSocket connections
2. **Command Parser** (port 5000): Processes speech commands using NLP
3. **Session Service** (port 3002): Manages session persistence

## Development

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Docker

```bash
# Build image
docker build -t gateway-api .

# Run container
docker run -p 3001:3001 gateway-api
```

## Architecture

The Gateway API follows a proxy pattern where it:
1. Receives requests from the frontend
2. Authenticates and validates requests
3. Routes to appropriate microservices
4. Aggregates responses
5. Returns unified responses to frontend

This provides a clean separation of concerns and allows the frontend to interact with a single API endpoint.
