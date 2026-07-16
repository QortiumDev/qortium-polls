export type BridgeState = {
  actions: string[];
  isHomeBridge: boolean;
  isUsingPublicNode?: boolean;
  ui: string;
};

export type NodeApiFetchResult = {
  body: string;
  contentLength?: number;
  contentType: string;
  data: unknown;
  ok: boolean;
  status: number;
  statusText: string;
};

export type QdnResource = {
  created?: number;
  description?: string;
  identifier?: string;
  name?: string;
  service?: string;
  size?: number;
  status?: string;
  title?: string;
  updated?: number;
  [key: string]: unknown;
};

export type NodeStatus = {
  height?: number;
  isSynchronizing?: boolean;
  numberOfConnections?: number;
  syncPercent?: number;
  syncPhase?: string;
  [key: string]: unknown;
};

export type HostInfo = {
  hostName?: string;
  hostVersion?: string;
  platformVersion?: string;
};

export type PollOption = {
  optionName: string;
};

export type Poll = {
  pollId: number;
  pollName: string;
  description?: string;
  owner: string;
  pollOptions: PollOption[];
  published?: number;
  startTime?: number | null;
  endTime?: number | null;
};

export type PendingVotePhase = 'signing' | 'pending' | 'confirmed' | 'failed' | 'timeout';

export type PendingVote = {
  pollId: number;
  indexes: number[];
  signature?: string;
  phase: PendingVotePhase;
  submittedAt: number;
};

export type PollVotes = {
  totalVotes?: number;
  totalVoters?: number;
  totalWeight?: number;
  rawTotalWeight?: number;
  voteCounts?: {
    optionName: string;
    voteCount: number;
  }[];
  voteWeights?: {
    optionName: string;
    voteWeight: number;
    rawVoteWeight: number;
  }[];
  voteDetails?: {
    voterAddress: string;
    optionIndexes?: number[];
    optionIndex?: number;
    rawVoteWeight?: number;
    trustStatus?: string;
    trustWeightPercent?: number;
    effectiveVoteWeight?: number;
  }[];
};
