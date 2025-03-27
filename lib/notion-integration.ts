interface NotionTaskProps {
  apiKey: string
  databaseId: string
  title: string
  assignee?: string
  dueDate?: string | null
  meetingTitle?: string
}

/**
 * Sends a task to Notion
 * In a real implementation, this would use the Notion API
 */
export async function sendToNotion({
  apiKey,
  databaseId,
  title,
  assignee,
  dueDate,
  meetingTitle,
}: NotionTaskProps): Promise<void> {
  // This is a mock implementation
  // In a real implementation, you would use the Notion API

  console.log("Sending to Notion:", {
    title,
    assignee,
    dueDate,
    meetingTitle,
  })

  // Simulate API call
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      // Simulate success (90% of the time)
      if (Math.random() > 0.1) {
        resolve()
      } else {
        // Simulate error (10% of the time)
        reject(new Error("Failed to create task in Notion"))
      }
    }, 1000)
  })

  /* 
  // Real implementation would look something like this:
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
        Status: {
          select: {
            name: 'To Do',
          },
        },
        ...(assignee && {
          Assignee: {
            rich_text: [
              {
                text: {
                  content: assignee,
                },
              },
            ],
          },
        }),
        ...(dueDate && {
          'Due Date': {
            date: {
              start: dueDate,
            },
          },
        }),
        ...(meetingTitle && {
          Source: {
            rich_text: [
              {
                text: {
                  content: `Meeting: ${meetingTitle}`,
                },
              },
            ],
          },
        }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create task in Notion');
  }

  return response.json();
  */
}

