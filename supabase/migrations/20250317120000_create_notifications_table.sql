-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('challenge_vote', 'nice_reco', 'answer_selected', 'request_answered')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ref_submission_id UUID,
  ref_answer_id UUID,
  ref_request_id UUID,
  ref_voter_id UUID,
  ref_rater_id UUID,
  ref_requester_id UUID
);

-- Index for efficient lookups by recipient
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Index for unread notifications
CREATE INDEX idx_notifications_user_read_at ON notifications(user_id, read_at);

-- Optional: Add comments for documentation
COMMENT ON TABLE notifications IS 'User notifications for challenge votes, nice recos, answer selections, and request answers';
COMMENT ON COLUMN notifications.user_id IS 'Recipient user ID';
COMMENT ON COLUMN notifications.type IS 'Notification type: challenge_vote, nice_reco, answer_selected, request_answered';
COMMENT ON COLUMN notifications.read_at IS 'When the notification was read; NULL when unread';
