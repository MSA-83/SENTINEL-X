# SENTINEL-X API Documentation

## Base URL
```
https://api.sentinel-x.com/v1
```

## Authentication

All API requests require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_api_token>
```

## Endpoints

### Threats

#### Get All Threats
```http
GET /threats
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| severity | string | Filter by severity (critical, high, medium, low) |
| status | string | Filter by status (new, investigating, resolved) |
| limit | int | Max results (default: 100) |
| offset | int | Pagination offset |
| from | ISO date | Filter by created_at >= from |
| to | ISO date | Filter by created_at <= to |

#### Get Single Threat
```http
GET /threats/:id
```

#### Create Threat
```http
POST /threats
```

Request Body:
```json
{
  "title": "string",
  "description": "string",
  "severity": "critical|high|medium|low",
  "threat_type": "string",
  "location": {"lat": 0, "lng": 0},
  "source": "ads_b|ais|sigint|..."
}
```

#### Update Threat
```http
PATCH /threats/:id
```

#### Delete Threat
```http
DELETE /threats/:id
```

### Cases

#### Get All Cases
```http
GET /cases
```

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | open, in_progress, resolved, closed |
| priority | string | critical, high, medium, low |
| assigned_to | string | User ID |

#### Get Single Case
```http
GET /cases/:id
```

#### Create Case
```http
POST /cases
```

Request Body:
```json
{
  "title": "string",
  "description": "string",
  "priority": "critical|high|medium|low",
  "case_type": "string",
  "assigned_to": "user_id"
}
```

#### Add Note to Case
```http
POST /cases/:id/notes
```

```json
{"content": "string"}
```

#### Link Threat to Case
```http
POST /cases/:id/threats
```

```json
{"threat_id": "string"}
```

### Entities

#### Get All Entities
```http
GET /entities
```

| Parameter | Type | Description |
|-----------|------|-------------|
| entity_type | string | aircraft, vessel, facility, signal |
| risk_level | string | critical, high, medium, low |

#### Get Single Entity
```http
GET /entities/:id
```

#### Get Entity History
```http
GET /entities/:id/history
```

### Alerts

#### Get All Alerts
```http
GET /alerts
```

| Parameter | Type | Description |
|-----------|------|-------------|
| severity | string | critical, high, medium, low |
| status | string | active, acknowledged, resolved |

#### Create Alert Rule
```http
POST /alert-rules
```

```json
{
  "name": "string",
  "condition": {"field": "severity", "eq": "critical"},
  "severity": "critical",
  "channels": ["email", "sms"],
  "cooldown_minutes": 15
}
```

### Analytics

#### Get Stats
```http
GET /analytics/stats
```

```json
{
  "total": 0,
  "critical": 0,
  "high": 0,
  "medium": 0,
  "low": 0
}
```

#### Get Timeline
```http
GET /analytics/timeline?time_range=24
```

#### Get Hotspots
```http
GET /analytics/hotspots?limit=10
```

### Search

#### Search All
```http
GET /search?q=query
```

| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| type | string | threat, case, entity |
| severity | string | Filter severity |
| date_range | string | 24h, 7d, 30d |

### AI Assistant

#### Chat
```http
POST /ai/chat
```

```json
{
  "message": "string",
  "conversation_id": "string (optional)"
}
```

### Files

#### Upload File
```http
POST /files
```

Content-Type: multipart/form-data

#### Download File
```http
GET /files/:id/download
```

## Webhooks

### Register Webhook
```http
POST /webhooks
```

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["threat.created", "alert.created", "case.resolved"]
}
```

## Rate Limits

| Tier | Requests/minute | Burst |
|------|----------------|-------|
| Free | 60 | 100 |
| Pro | 300 | 500 |
| Enterprise | 1000 | 2000 |

## Error Responses

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Invalid or missing token |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Invalid request body |
| RATE_LIMIT_EXCEEDED | Too many requests |

## SDK Examples

### JavaScript
```javascript
const client = new SentinelClient({ apiKey: 'your_key' })
const threats = await client.threats.list({ severity: 'critical' })
```

### Python
```python
from sentinel import Client

client = Client(api_key='your_key')
threats = client.threats.list(severity='critical')
```

## Changelog

### v1.0.0
- Initial release
- Core endpoints: threats, cases, entities, alerts
- AI assistant chat
- File uploads