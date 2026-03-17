-- Fix: Trigger functions must run as SECURITY DEFINER to bypass RLS
-- when inserting notifications for other users (recipients).

CREATE OR REPLACE FUNCTION notify_challenge_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_user_id UUID;
BEGIN
  SELECT user_id INTO sub_user_id FROM challenge_submissions WHERE id = NEW.submission_id;
  IF sub_user_id IS NOT NULL AND sub_user_id != NEW.voter_id THEN
    INSERT INTO notifications (user_id, type, ref_submission_id, ref_voter_id)
    VALUES (sub_user_id, 'challenge_vote', NEW.submission_id, NEW.voter_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_nice_reco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ans_responder_id UUID;
  req_id UUID;
BEGIN
  SELECT responder_id, request_id INTO ans_responder_id, req_id
  FROM qna_answers WHERE id = NEW.answer_id;
  IF ans_responder_id IS NOT NULL AND ans_responder_id != NEW.rater_id THEN
    INSERT INTO notifications (user_id, type, ref_answer_id, ref_request_id, ref_rater_id)
    VALUES (ans_responder_id, 'nice_reco', NEW.answer_id, req_id, NEW.rater_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_answer_selected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ans_responder_id UUID;
  req_requester_id UUID;
BEGIN
  IF NEW.best_answer_id IS NOT NULL AND (OLD.best_answer_id IS NULL OR OLD.best_answer_id != NEW.best_answer_id) THEN
    SELECT responder_id INTO ans_responder_id FROM qna_answers WHERE id = NEW.best_answer_id;
    req_requester_id := NEW.requester_id;
    IF ans_responder_id IS NOT NULL AND ans_responder_id != req_requester_id THEN
      INSERT INTO notifications (user_id, type, ref_answer_id, ref_request_id, ref_requester_id)
      VALUES (ans_responder_id, 'answer_selected', NEW.best_answer_id, NEW.id, req_requester_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_request_answered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_requester_id UUID;
BEGIN
  SELECT requester_id INTO req_requester_id FROM qna_requests WHERE id = NEW.request_id;
  IF req_requester_id IS NOT NULL AND req_requester_id != NEW.responder_id THEN
    INSERT INTO notifications (user_id, type, ref_answer_id, ref_request_id)
    VALUES (req_requester_id, 'request_answered', NEW.id, NEW.request_id);
  END IF;
  RETURN NEW;
END;
$$;
