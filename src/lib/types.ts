export type BoardStatus = "active" | "revealed" | "archived";
export type MemberRole = "owner" | "member";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarPixels: string[];
};

export type Board = {
  id: string;
  name: string;
  size: number;
  status: BoardStatus;
  ownerMode: boolean;
  revealEnabled: boolean;
  winLogicEnabled: boolean;
  revealDeadline: string | null;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
};

export type Member = {
  boardId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
};

export type Cell = {
  id: string;
  boardId: string;
  row: number;
  col: number;
  title: string;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type Progress = {
  cellId: string;
  userId: string;
  completed: boolean;
  note: string;
  photoDataUrl: string | null;
  updatedAt: string;
};

export type RevealVote = {
  boardId: string;
  userId: string;
  votedAt: string;
};

export type RevealSession = {
  boardId: string;
  currentIndex: number;
  startedAt: string;
  finishedAt: string | null;
};

export type RevealDownvote = {
  boardId: string;
  cellId: string;
  targetUserId: string;
  voterUserId: string;
  createdAt: string;
};

export type BingoEvent = {
  id: string;
  boardId: string;
  userId: string;
  lines: string[];
  createdAt: string;
};

export type BoardNotice = {
  id: string;
  boardId: string;
  type: "bingo" | "revealed" | "joined";
  actorUserId: string;
  message: string;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarPixels: string[];
};

export type BoardSummary = {
  board: Board;
  role: MemberRole;
  memberCount: number;
  ownCompleted: number;
  totalCells: number;
  hasBingo: boolean;
};

export type BoardDetail = {
  board: Board;
  members: Array<Member & { profile: PublicProfile }>;
  cells: Cell[];
  progress: Array<Progress & { profile: PublicProfile }>;
  revealVotes: RevealVote[];
  revealSession: RevealSession | null;
  revealDownvotes: RevealDownvote[];
  votesNeeded: number;
  notices: BoardNotice[];
  bingoEvents: BingoEvent[];
  viewerRole: MemberRole;
  canInvite: boolean;
  canRevealNow: boolean;
  canManage: boolean;
  canDelete: boolean;
};

export type CreateBoardInput = {
  name: string;
  size: number;
  ownerMode: boolean;
  revealEnabled: boolean;
  winLogicEnabled: boolean;
  revealDeadline: string | null;
};

export type UpdateBoardInput = {
  name?: string;
  ownerMode?: boolean;
  revealEnabled?: boolean;
  winLogicEnabled?: boolean;
  revealDeadline?: string | null;
};
