interface ActionItem {
  text: string
  assignee: string
  dueDate: string | null
}

/**
 * Extracts action items from meeting transcripts
 * In a real implementation, this would use an LLM for more accurate extraction
 */
export async function extractActionItems(transcript: string): Promise<ActionItem[]> {
  // Simple pattern matching for action items
  // In a real implementation, you would use an LLM for better extraction
  const actionItemPatterns = [
    /(?:action item|task|todo|to do|follow up|followup)(?:\s*:|\s+for\s+)?\s*([^.!?]+[.!?])/gi,
    /([^.!?]*(?:will|should|needs to|has to|going to)\s+[^.!?]*[.!?])/gi,
    /([^.!?]*\b(?:by|before|due)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|end of day|eod)[^.!?]*[.!?])/gi,
  ]

  const actionItems: ActionItem[] = []
  const processedTexts = new Set<string>()

  // Extract potential action items using patterns
  for (const pattern of actionItemPatterns) {
    const matches = transcript.matchAll(pattern)
    for (const match of matches) {
      const text = match[1]?.trim() || match[0]?.trim()

      // Skip if empty or already processed
      if (!text || processedTexts.has(text.toLowerCase())) continue

      // Extract potential assignee
      let assignee = ""
      const assigneeMatch = text.match(/\b(john|sarah|mike|emily|alex|david)\b/i)
      if (assigneeMatch) {
        assignee = assigneeMatch[0]
      }

      // Extract potential due date
      let dueDate: string | null = null
      const dateMatch = text.match(/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|next week)\b/i)
      if (dateMatch) {
        const today = new Date()
        const dayMap: Record<string, number> = {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
          sunday: 0,
        }

        if (dateMatch[0].toLowerCase() === "tomorrow") {
          const tomorrow = new Date(today)
          tomorrow.setDate(today.getDate() + 1)
          dueDate = tomorrow.toISOString().split("T")[0]
        } else if (dateMatch[0].toLowerCase() === "next week") {
          const nextWeek = new Date(today)
          nextWeek.setDate(today.getDate() + 7)
          dueDate = nextWeek.toISOString().split("T")[0]
        } else {
          const dayOfWeek = dayMap[dateMatch[0].toLowerCase()]
          const targetDate = new Date(today)
          const currentDay = today.getDay()
          const daysToAdd = (dayOfWeek - currentDay + 7) % 7
          targetDate.setDate(today.getDate() + daysToAdd)
          dueDate = targetDate.toISOString().split("T")[0]
        }
      }

      actionItems.push({
        text,
        assignee,
        dueDate,
      })

      processedTexts.add(text.toLowerCase())
    }
  }

  return actionItems
}

