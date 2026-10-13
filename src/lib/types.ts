// Client-safe mirrors of server types.
export type Prompt = { question_key: string; answer_text: string };
export type PublicProfile = {
  id: number;
  full_name: string;
  age: number | null;
  location: string | null;
  occupation: string | null;
  bio: string | null;
  photos: string[];
  is_verified: boolean;
  is_demo: boolean;
  religiosity: "secular" | "traditional" | "religious" | null;
  marital_status: "single" | "divorced" | "widowed" | null;
  looking_for: "serious" | "open" | "casual" | null;
  prompts: Prompt[];
};
export type Candidate = PublicProfile & { compatibility: number; likedYou: boolean; distanceKm?: number | null; shared?: string[]; locked?: boolean };
export type ChatMessage = { id: number; match_id: number; sender_id: number; text_content: string; is_read: boolean; sent_at: string };
export type RealtimeEvent =
  | { type: "message"; matchId: number; message: ChatMessage }
  | { type: "read"; matchId: number; readerId: number }
  | { type: "typing"; matchId: number; userId: number }
  | { type: "match"; matchId: number; withUserId: number };
