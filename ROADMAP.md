# Pickleball AI Coach Roadmap

## Phase 0: Planning

Goal:
Finalize architecture before coding.

Tasks:

- Confirm stack
- Confirm database schema
- Confirm MVP features
- Confirm folder structure
- Create implementation tickets

## Phase 1: App Foundation

Goal:
Create the basic production-ready app shell.

Tasks:

- Set up monorepo
- Set up Next.js frontend
- Set up backend API
- Set up database
- Set up auth
- Set up environment variables
- Set up shared types
- Set up linting/formatting
- Set up basic CI

## Phase 2: Video Upload

Goal:
Allow users to upload and manage videos.

Tasks:

- Create upload page
- Store video files
- Create video records
- Generate signed URLs
- Show upload status
- Show video list
- Show video detail page

## Phase 3: Video Processing

Goal:
Process videos in the background.

Tasks:

- Add worker service (**done:** `apps/worker` polls Postgres; queue optional next)
- Add job queue
- Run FFmpeg metadata extraction
- Generate thumbnail
- Update processing status
- Handle failed jobs

## Phase 4: Video Review Studio

Goal:
Create the core product experience.

Tasks:

- Add video player
- Add timeline
- Add keyboard shortcuts
- Add shot event creation
- Add shot event editing
- Add shot event deletion
- Add timeline markers

## Phase 5: Stats Engine

Goal:
Turn tagged events into useful pickleball stats.

Tasks:

- Calculate serve percentage
- Calculate return error rate
- Calculate forehand/backhand error rate
- Calculate third-shot drop success rate
- Calculate rally length
- Calculate winners/errors
- Build stats dashboard

## Phase 6: Feedback Reports

Goal:
Generate coaching insights from stats.

Tasks:

- Identify strongest shot
- Identify weakest shot
- Identify most common error
- Generate recommended drills
- Show feedback report page

## Phase 7: Subscription Readiness

Goal:
Prepare the app to become sellable.

Tasks:

- Add Stripe
- Add free/pro/coach plans
- Add upload limits
- Add storage limits
- Add billing page
- Add subscription enforcement

## Phase 8: Coach/Team Features

Goal:
Support higher-value paid customers.

Tasks:

- Organizations
- Coach dashboard
- Player management
- Shared reports
- Team stats

## Phase 9: AI-Assisted Tagging

Goal:
Use AI to suggest tags, not replace humans yet.

Tasks:

- Create AI prediction table
- Extract frames
- Add basic pose detection
- Show AI suggestions
- Allow accept/reject
- Save corrections as training labels

## Phase 10: Advanced AI

Goal:
Improve automation.

Tasks:

- Court detection
- Player movement tracking
- Shot classification
- Ball tracking
- Auto rally segmentation
- Auto highlight generation
