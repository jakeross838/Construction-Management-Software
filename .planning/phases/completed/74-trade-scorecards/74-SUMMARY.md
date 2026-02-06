# Phase 74: Trade Scorecards - Summary

**Completed:** 2026-01-20
**Migration:** 087

---

## What Was Built

### Database (migration-087-trade-scorecards.sql)

1. **Extended v2_vendors table**:
   - `is_trade_partner` boolean flag
   - `trade_ids` array of linked trades
   - `capacity_per_week` hours/units
   - `min_project_size`, `max_project_size` ranges

2. **v2_trade_assignments table**:
   - Links vendor to job for specific trade
   - Status: proposed, confirmed, declined, completed
   - Bid tracking: quoted amount, actual amount
   - Performance tracking dates

3. **v2_trade_scores table**:
   - Overall score (1-100)
   - Category scores:
     - Quality score
     - Schedule score
     - Communication score
     - Safety score
     - Price score
   - Score count (number of ratings)
   - Trend indicator: improving, stable, declining

4. **v2_trade_reviews table**:
   - Per-job reviews
   - Category ratings (1-5 stars)
   - Pros and cons
   - Would hire again flag
   - Private notes

5. **v2_trade_capacity table**:
   - Weekly availability tracking
   - Committed hours per week
   - Available hours calculation

6. **Database functions**:
   - `calculate_trade_score(vendor_id)` - Aggregate scores from reviews
   - `get_recommended_trades(job_id, trade_id)` - Rank vendors by fit
   - `get_vendor_availability(vendor_id, date_range)` - Check capacity

---

## API Endpoints

### Trade Partner Management
- `GET /api/vendors/trade-partners` - List trade partners with scores
- `PATCH /api/vendors/:id/trade-partner` - Enable/update trade partner status

### Scores
- `GET /api/vendors/:id/scorecard` - Full scorecard with history
- `GET /api/trades/:tradeId/leaderboard` - Top vendors by trade

### Reviews
- `POST /api/jobs/:jobId/trade-reviews` - Submit review
- `GET /api/vendors/:id/reviews` - Get vendor reviews
- `PATCH /api/trade-reviews/:id` - Update review

### Capacity
- `GET /api/vendors/:id/capacity` - Get availability
- `POST /api/vendors/:id/capacity` - Set weekly capacity
- `GET /api/trades/:tradeId/availability` - Find available vendors

### Recommendations
- `GET /api/jobs/:jobId/trade-recommendations` - Get recommended vendors

---

## UI Features

### Vendor Scorecard View

Added to vendor detail modal:
- Overall score ring (0-100)
- Category breakdown chart
- Trend indicator (arrow up/down/sideways)
- Review history with filters
- Jobs completed count
- Average vs quoted variance

### Trade Leaderboard

By trade type:
- Ranked list of vendors
- Score, review count, availability
- Quick assign button
- Contact actions

### Review Submission

After job completion:
- 5-star rating per category
- Pros/cons text fields
- Would hire again checkbox
- Auto-recalculates vendor score

### Recommendation Engine

When assigning trades:
1. Shows top 5 vendors for trade
2. Factors: score, availability, past experience with job type
3. Price history comparison
4. Availability calendar preview

---

## Score Calculation

```
Overall = (Quality × 0.30) + (Schedule × 0.25) + (Communication × 0.20) +
          (Safety × 0.15) + (Price × 0.10)

Each category = Average of job reviews × recency weight
Recency weight = More recent reviews weighted higher
```

---

## Notes

Trade Scorecards enable:
1. Track vendor performance over time
2. Make data-driven hiring decisions
3. Identify capacity constraints
4. Reward top performers with more work
5. Document issues for future reference
