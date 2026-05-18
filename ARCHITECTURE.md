# Pickleball AI Coach Architecture

## Goal

Design a production-grade SaaS architecture that can start as an MVP and later scale into a commercial pickleball video analytics platform.

## Recommended Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind
- shadcn/ui
- TanStack Query

Backend:

- Node/NestJS or FastAPI
- REST API first
- Typed API contracts

Database:

- Postgres
- Prisma if TypeScript backend
- SQLAlchemy if Python backend

Auth:

- Clerk or Supabase Auth

Storage:

- S3-compatible object storage
- Signed URLs for private videos

Video Processing:

- FFmpeg
- Background worker
- Async job queue

Queue:

- Redis + BullMQ if Node
- Celery/RQ if Python
- Cloud Tasks or Pub/Sub later

AI Service:

- Separate Python service
- OpenCV
- MediaPipe or MoveNet
- YOLO-style detection later

Payments:

- Stripe

Observability:

- Sentry
- PostHog
- Structured logs

Deployment:

- Frontend: Vercel
- API: Cloud Run, Render, Fly.io, or AWS ECS
- Worker: Cloud Run jobs or background worker
- DB: Supabase/Neon/RDS
- Storage: S3/Supabase Storage

## Monorepo Structure

/apps
/web
/api
/worker
/ai-service

/packages
/ui
/types
/database
/config

/docs
SPEC.md
ARCHITECTURE.md
ROADMAP.md

/infrastructure
/docker
/terraform

## Main Services

1. Web App

- User dashboard
- Upload page
- Video review studio
- Stats dashboard
- Feedback reports
- Billing/settings

2. API Server

- Auth verification
- Video records
- Match/rally/shot APIs
- Stats calculation
- Feedback generation
- Subscription enforcement

3. Worker (`apps/worker`)

- Polls Postgres for `uploaded` (and stale `processing`) videos; claims with `FOR UPDATE SKIP LOCKED`
- Downloads the source object from the user bucket, runs **ffprobe** + **ffmpeg**
- Writes `poster.jpg` beside the source key, updates `duration_seconds`, `fps`, `width`/`height`, `thumbnail_object_key`
- Marks `ready` or `failed` + `failure_message`; queue integration can call the same processor later

4. AI Service

- Pose detection
- Court detection
- Shot classification
- Ball tracking later
- Model versioning

5. Database

- Users
- Videos
- Matches
- Rallies
- Shot events
- Stats
- Feedback
- AI predictions
- Training labels

## Database Tables

users

- id
- email
- name
- created_at

organizations

- id
- name
- owner_id
- created_at

organization_members

- id
- organization_id
- user_id
- role

subscriptions

- id
- user_id
- organization_id
- stripe_customer_id
- stripe_subscription_id
- plan
- status

videos

- id
- user_id
- organization_id
- title
- source_url
- duration
- fps
- resolution
- file_size
- processing_status
- privacy_status
- created_at

video_assets

- id
- video_id
- asset_type
- storage_url
- metadata
- created_at

matches

- id
- video_id
- title
- match_type
- played_at
- created_at

rallies

- id
- match_id
- video_id
- start_time
- end_time
- serving_team
- rally_length
- result

shot_events

- id
- video_id
- match_id
- rally_id
- timestamp
- player_id
- shot_type
- side
- outcome
- court_zone
- confidence_score
- source
- created_by
- model_version_id
- created_at

player_stats

- id
- user_id
- video_id
- match_id
- stat_key
- stat_value
- created_at

feedback_reports

- id
- user_id
- video_id
- summary
- strengths
- weaknesses
- recommended_drills
- created_at

ai_predictions

- id
- video_id
- timestamp
- prediction_type
- prediction_payload
- confidence_score
- model_version_id
- accepted_by_user
- created_at

training_labels

- id
- video_id
- shot_event_id
- label_type
- label_value
- source
- reviewer_id
- quality_score
- created_at

model_versions

- id
- name
- version
- model_type
- created_at

audit_logs

- id
- user_id
- action
- resource_type
- resource_id
- metadata
- created_at

## API Routes

Auth:

- GET /me

Videos:

- POST /videos
- GET /videos
- GET /videos/:id
- DELETE /videos/:id
- POST /videos/:id/process

Shot Events:

- POST /videos/:id/shot-events
- GET /videos/:id/shot-events
- PATCH /shot-events/:id
- DELETE /shot-events/:id

Rallies:

- POST /videos/:id/rallies
- GET /videos/:id/rallies
- PATCH /rallies/:id
- DELETE /rallies/:id

Stats:

- GET /videos/:id/stats
- GET /users/:id/stats

Feedback:

- POST /videos/:id/feedback
- GET /videos/:id/feedback

Billing:

- POST /billing/checkout
- POST /billing/webhook
- GET /billing/subscription

## Security Requirements

- Private videos by default
- Signed URLs
- Auth on every protected route
- Organization-based permissions
- File size limits
- Rate limits
- Stripe webhook verification
- Input validation
- Audit logs
- Separate dev/staging/prod environments

## Testing

- Unit tests for stats calculations
- API integration tests
- Component tests for tagging studio
- E2E test for upload → tag → stats
- Worker tests for video processing
