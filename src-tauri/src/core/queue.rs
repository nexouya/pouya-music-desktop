use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

use super::track::Track;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    #[default]
    Off,
    All,
    One,
}

/// Queue owns order, shuffle bag, and repeat policy.
/// Single-writer semantics: only the player core mutates this.
#[derive(Debug, Clone, Default)]
pub struct Queue {
    tracks: Vec<Track>,
    order: Vec<usize>,
    cursor: usize,
    shuffle: bool,
    repeat: RepeatMode,
}

impl Queue {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_tracks(&mut self, tracks: Vec<Track>, start_index: usize) {
        self.tracks = tracks;
        self.cursor = start_index.min(self.tracks.len().saturating_sub(1));
        if self.tracks.is_empty() {
            self.cursor = 0;
        }
        self.rebuild_order();
    }

    pub fn push(&mut self, track: Track) {
        let idx = self.tracks.len();
        self.tracks.push(track);
        self.order.push(idx);
    }

    pub fn clear(&mut self) {
        self.tracks.clear();
        self.order.clear();
        self.cursor = 0;
    }

    pub fn tracks(&self) -> &[Track] {
        &self.tracks
    }

    pub fn len(&self) -> usize {
        self.tracks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tracks.is_empty()
    }

    pub fn cursor(&self) -> usize {
        self.cursor
    }

    pub fn current(&self) -> Option<&Track> {
        self.order
            .get(self.cursor)
            .and_then(|&i| self.tracks.get(i))
    }

    pub fn shuffle_enabled(&self) -> bool {
        self.shuffle
    }

    pub fn repeat_mode(&self) -> RepeatMode {
        self.repeat
    }

    pub fn set_shuffle(&mut self, enabled: bool) {
        if self.shuffle == enabled {
            return;
        }
        self.shuffle = enabled;
        let current_track_id = self.current().map(|t| t.id.clone());
        self.rebuild_order();
        if let Some(id) = current_track_id {
            if let Some(pos) = self
                .order
                .iter()
                .position(|&i| self.tracks.get(i).map(|t| t.id.as_str()) == Some(id.as_str()))
            {
                self.cursor = pos;
            }
        }
    }

    pub fn set_repeat(&mut self, mode: RepeatMode) {
        self.repeat = mode;
    }

    pub fn jump(&mut self, index: usize) -> Option<&Track> {
        if index >= self.order.len() {
            return None;
        }
        self.cursor = index;
        self.current()
    }

    /// Advance using repeat policy. Returns the new current track if any.
    /// `from_ended` is true when the audio element fired `ended`.
    pub fn next(&mut self, from_ended: bool) -> Option<&Track> {
        if self.tracks.is_empty() {
            return None;
        }

        if from_ended && self.repeat == RepeatMode::One {
            // Stay on the same track for replay.
            return self.current();
        }

        if self.cursor + 1 < self.order.len() {
            self.cursor += 1;
            return self.current();
        }

        match self.repeat {
            RepeatMode::All | RepeatMode::One => {
                self.cursor = 0;
                self.current()
            }
            RepeatMode::Off => {
                if from_ended {
                    None
                } else {
                    // Manual next wraps for UX even when repeat is off.
                    self.cursor = 0;
                    self.current()
                }
            }
        }
    }

    pub fn prev(&mut self) -> Option<&Track> {
        if self.tracks.is_empty() {
            return None;
        }
        if self.cursor == 0 {
            self.cursor = self.order.len().saturating_sub(1);
        } else {
            self.cursor -= 1;
        }
        self.current()
    }

    fn rebuild_order(&mut self) {
        self.order = (0..self.tracks.len()).collect();
        if self.shuffle && self.order.len() > 1 {
            let mut rng = rand::thread_rng();
            // Keep current track stable if possible.
            let current_idx = self.order.get(self.cursor).copied();
            self.order.shuffle(&mut rng);
            if let Some(ci) = current_idx {
                if let Some(pos) = self.order.iter().position(|&i| i == ci) {
                    self.order.swap(0, pos);
                    self.cursor = 0;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str) -> Track {
        Track {
            id: id.into(),
            title: id.into(),
            artist: "a".into(),
            url: "u".into(),
            duration: Some(1.0),
            cover_url: String::new(),
            is_local: true,
            category: None,
            album: None,
            cover_filename: None,
            recommendation_reason: None,
            confidence_score: None,
            exploration_tag: None,
            source: Some("local".into()),
        }
    }

    #[test]
    fn next_respects_off_and_wraps_on_manual() {
        let mut q = Queue::new();
        q.set_tracks(vec![track("a"), track("b")], 0);
        assert_eq!(q.next(false).unwrap().id, "b");
        // At end with RepeatMode::Off: ended stops, manual next wraps.
        assert_eq!(q.next(true), None);
        assert_eq!(q.next(false).unwrap().id, "a");
    }

    #[test]
    fn repeat_all_wraps_on_end() {
        let mut q = Queue::new();
        q.set_tracks(vec![track("a"), track("b")], 1);
        q.set_repeat(RepeatMode::All);
        assert_eq!(q.next(true).unwrap().id, "a");
    }

    #[test]
    fn repeat_one_stays_on_end() {
        let mut q = Queue::new();
        q.set_tracks(vec![track("a"), track("b")], 0);
        q.set_repeat(RepeatMode::One);
        assert_eq!(q.next(true).unwrap().id, "a");
    }

    #[test]
    fn shuffle_keeps_current() {
        let mut q = Queue::new();
        q.set_tracks(
            vec![track("a"), track("b"), track("c"), track("d")],
            2,
        );
        let before = q.current().unwrap().id.clone();
        q.set_shuffle(true);
        assert_eq!(q.current().unwrap().id, before);
    }
}
