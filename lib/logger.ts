export type LogEvent = {
  name: string
  group_id?: string
  challenge_id?: string
  data?: unknown
  user_id?: string
  error?: unknown
  metadata?: Record<string, unknown>
}

export function log(e: LogEvent) {
  try {
    const payload = { 
      t: Date.now(), 
      timestamp: new Date().toISOString(),
      ...e 
    }
    console.log(JSON.stringify(payload))
  } catch {}
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    log({ name: "info", data: { message, ...data } })
  },
  error: (message: string, data?: Record<string, unknown>) => {
    log({ name: "error", data: { message, ...data } })
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    log({ name: "debug", data: { message, ...data } })
  },
  
  // Specific logging functions for key flows
  groupCreated: (groupId: string, userId: string, metadata?: Record<string, unknown>) => {
    log({ name: "group_created", group_id: groupId, user_id: userId, metadata })
  },
  
  inviteGenerated: (groupId: string, token: string, metadata?: Record<string, unknown>) => {
    log({ name: "invite_generated", group_id: groupId, data: { token }, metadata })
  },
  
  inviteConsumed: (token: string, userId: string, groupId: string, metadata?: Record<string, unknown>) => {
    log({ name: "invite_consumed", group_id: groupId, user_id: userId, data: { token }, metadata })
  },
  
  preferencesSaved: (groupId: string, preferences: unknown, weekStart: string, isFrozen: boolean) => {
    log({ 
      name: "preferences_saved", 
      group_id: groupId, 
      data: { preferences, week_start: weekStart, is_frozen: isFrozen } 
    })
  },
  
  challengeScheduled: (groupId: string, challengeId: string, scheduledAt: string, timesPerDay: number) => {
    log({ 
      name: "challenge_scheduled", 
      group_id: groupId, 
      challenge_id: challengeId, 
      data: { scheduled_at: scheduledAt, times_per_day: timesPerDay } 
    })
  },
  
  challengeCompleted: (challengeId: string, userId: string, groupId: string, bothCompleted: boolean) => {
    log({ 
      name: "challenge_completed", 
      challenge_id: challengeId, 
      group_id: groupId, 
      user_id: userId, 
      data: { both_completed: bothCompleted } 
    })
  },
  
  aiRequest: (groupId: string, requestData: unknown, priorCount: number) => {
    log({ 
      name: "ai_request", 
      group_id: groupId, 
      data: { 
        request_data: requestData, 
        prior_challenges_count: priorCount,
        sample_titles: priorCount > 0 ? "[sample titles included]" : "[]"
      } 
    })
  },
  
  aiResponse: (groupId: string, responseData: unknown) => {
    log({ 
      name: "ai_response", 
      group_id: groupId, 
      data: { response_data: responseData } 
    })
  },
  
  longDistanceToggled: (groupId: string, enabled: boolean) => {
    log({ 
      name: "long_distance_toggled", 
      group_id: groupId, 
      data: { enabled } 
    })
  },
  
  notificationSent: (groupId: string, type: string, challengeId?: string) => {
    log({ 
      name: "notification_sent", 
      group_id: groupId, 
      challenge_id: challengeId, 
      data: { notification_type: type } 
    })
  },
  
  historyRetrieved: (groupId: string, count: number) => {
    log({ 
      name: "history_retrieved", 
      group_id: groupId, 
      data: { challenge_count: count } 
    })
  },
  
  roadmapRendered: (groupId: string, weekCount: number) => {
    log({ 
      name: "roadmap_rendered", 
      group_id: groupId, 
      data: { week_count: weekCount } 
    })
  }
}
