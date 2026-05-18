# Pickleball AI Coach SPEC

## Product Vision

Build a production-grade pickleball video analytics SaaS app that helps players improve by uploading match/practice videos, tagging shots, tracking stats, and receiving coaching feedback.

End goal: a sellable product for players, coaches, clubs, and teams.

Think: Hudl + Strava + AI coach for pickleball.

## Core User Types

1. Individual player
2. Coach
3. Club/team admin
4. Future: tournament/league organizer

## MVP Goal

The MVP should not try to fully automate pickleball AI detection immediately.

The MVP should focus on:

1. User authentication
2. Video upload
3. Video review player
4. Manual shot/event tagging
5. Match stats dashboard
6. Feedback report
7. Progress tracking over time

Manual tagging creates the data foundation for future AI.

## Core MVP Features

### Auth

- Sign up
- Login
- Logout
- User profile

### Video Upload

- Upload pickleball video
- Store video securely
- Track processing status
- Generate thumbnail
- Save metadata like duration, file size, resolution

### Video Review Studio

- Play/pause video
- Scrub timeline
- Add timestamped shot events
- Edit/delete shot events
- Keyboard shortcuts for tagging
- Show timeline markers

### Shot/Event Tagging

Track:

- Serve
- Return
- Forehand
- Backhand
- Dink
- Volley
- Drive
- Drop
- Third-shot drop
- Reset
- Lob
- Overhead

Track outcomes:

- In
- Out
- Net
- Winner
- Forced error
- Unforced error

Track metadata:

- Timestamp
- Player
- Shot type
- Forehand/backhand
- Court zone
- Rally id
- Confidence score
- Source: manual, AI, edited AI

### Stats Dashboard

Show:

- Total errors
- Forehand error rate
- Backhand error rate
- Return error rate
- Serve percentage
- Third-shot drop success rate
- Dink error rate
- Volley error rate
- Average rally length
- Winners
- Forced errors
- Unforced errors
- Most common mistake
- Strongest shot
- Weakest shot

### Feedback Report

Generate simple coaching feedback:

- Main weakness
- Main strength
- Top 3 improvement areas
- Recommended drills
- Progress over time

Example:
"Your biggest leak is backhand returns. 38% of your return errors came from the backhand side. Focus on cross-court backhand return depth drills."

## Future Paid Features

### Pro Player Plan

- More uploads
- More storage
- Advanced analytics
- AI-assisted tagging
- Progress tracking
- Personalized drills

### Coach Plan

- Manage multiple players
- Leave comments
- Share feedback reports
- Compare players
- Team dashboard

### Club Plan

- Organization dashboard
- Multiple coaches
- Player groups
- Bulk uploads
- Club analytics

## AI Roadmap

Phase 1:
Manual tagging

Phase 2:
AI-assisted suggestions

Phase 3:
Pose detection

Phase 4:
Court detection

Phase 5:
Shot classification

Phase 6:
Ball tracking

Phase 7:
Personalized AI coaching

Phase 8:
Auto highlights

## Important Product Rule

Do not build fragile fake AI early.

Build a strong tagging, stats, and feedback system first. Every manual tag and correction should become training data for future AI models.

## Legal Note

YouTube pro pickleball clips may be used only for research/reference. The product should rely on user-uploaded videos, licensed footage, or personally recorded videos.
