"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, MicOff, Trash, Check, Loader2, Settings } from "lucide-react"
import { pipe } from "@screenpipe/browser"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { extractActionItems } from "@/lib/action-extractor"
import { sendToNotion } from "@/lib/notion-integration"

interface TranscriptionChunk {
  id: string
  text: string
  timestamp: string
  isInput: boolean
  device: string
}

interface ActionItem {
  id: string
  text: string
  assignee: string
  dueDate: string | null
  status: "pending" | "sent" | "error"
  errorMessage?: string
}

export function MeetingActionAutomator() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState("")
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionChunk[]>([])
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [meetingTitle, setMeetingTitle] = useState("Team Meeting")
  const [meetingSummary, setMeetingSummary] = useState("")
  const [autoSendToNotion, setAutoSendToNotion] = useState(false)
  const [notionSettings, setNotionSettings] = useState({
    apiKey: "",
    databaseId: "",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("transcription")

  const streamRef = useRef<any>(null)
  const historyEndRef = useRef<HTMLDivElement>(null)
  const actionItemsEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when history updates
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [transcriptionHistory])

  // Scroll to bottom when action items update
  useEffect(() => {
    if (actionItemsEndRef.current) {
      actionItemsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }

    // Auto-send to Notion if enabled
    if (autoSendToNotion && actionItems.length > 0) {
      const pendingItems = actionItems.filter((item) => item.status === "pending")
      if (pendingItems.length > 0) {
        sendActionItemsToNotion(pendingItems)
      }
    }
  }, [actionItems, autoSendToNotion])

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.return()
      }
    }
  }, [])

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("notionSettings")
    if (savedSettings) {
      try {
        setNotionSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error("Failed to parse saved settings:", e)
      }
    }
  }, [])

  // Save settings to localStorage
  const saveSettings = (settings: typeof notionSettings) => {
    setNotionSettings(settings)
    localStorage.setItem("notionSettings", JSON.stringify(settings))
  }

  const startStreaming = async () => {
    try {
      setIsStreaming(true)
      setCurrentTranscription("")

      // Create a buffer for the current chunk
      let currentChunk = ""
      let chunkStartTime = new Date()
      let fullTranscript = ""

      // Start streaming transcriptions
      const stream = pipe.streamTranscriptions()
      streamRef.current = stream

      for await (const chunk of stream) {
        const text = chunk.choices[0].text
        const metadata = chunk.metadata || {}

        // Update current transcription
        setCurrentTranscription((prev) => prev + text)
        currentChunk += text
        fullTranscript += text

        // Process for action items periodically
        if (fullTranscript.length > 200 && fullTranscript.length % 100 < 10) {
          processForActionItems(fullTranscript)
        }

        // If we have a significant pause or a lot of text, add to history
        const now = new Date()
        if (now.getTime() - chunkStartTime.getTime() > 2000 || currentChunk.length > 100) {
          if (currentChunk.trim()) {
            const newHistoryItem: TranscriptionChunk = {
              id: Date.now().toString(),
              text: currentChunk.trim(),
              timestamp: chunkStartTime.toISOString(),
              isInput: metadata.isInput || false,
              device: metadata.device || "unknown",
            }

            setTranscriptionHistory((prev) => [...prev, newHistoryItem])
            setCurrentTranscription("")
            currentChunk = ""
            chunkStartTime = now
          }
        }
      }
    } catch (error) {
      console.error("Error streaming transcriptions:", error)
    } finally {
      setIsStreaming(false)
    }
  }

  const stopStreaming = async () => {
    if (streamRef.current) {
      await streamRef.current.return()
      streamRef.current = null
    }

    // Add any remaining current transcription to history
    if (currentTranscription.trim()) {
      const newHistoryItem: TranscriptionChunk = {
        id: Date.now().toString(),
        text: currentTranscription.trim(),
        timestamp: new Date().toISOString(),
        isInput: false,
        device: "unknown",
      }

      setTranscriptionHistory((prev) => [...prev, newHistoryItem])
      setCurrentTranscription("")
    }

    // Process the full transcript for a final summary
    const fullTranscript = transcriptionHistory.map((item) => item.text).join(" ") + " " + currentTranscription

    if (fullTranscript.trim()) {
      processForActionItems(fullTranscript, true)
      generateMeetingSummary(fullTranscript)
    }

    setIsStreaming(false)
  }

  const clearHistory = () => {
    setTranscriptionHistory([])
    setCurrentTranscription("")
    setActionItems([])
    setMeetingSummary("")
  }

  const processForActionItems = async (transcript: string, isFinal = false) => {
    try {
      // Extract action items from transcript
      const extractedItems = await extractActionItems(transcript)

      // Add new action items that don't already exist
      setActionItems((prevItems) => {
        const newItems = extractedItems
          .filter(
            (newItem) =>
              !prevItems.some((existingItem) => existingItem.text.toLowerCase() === newItem.text.toLowerCase()),
          )
          .map((item) => ({
            ...item,
            id: Date.now() + Math.random().toString(),
            status: "pending" as const,
          }))

        return [...prevItems, ...newItems]
      })

      // If this is the final processing, switch to the action items tab
      if (isFinal && extractedItems.length > 0) {
        setActiveTab("actions")
      }
    } catch (error) {
      console.error("Error extracting action items:", error)
    }
  }

  const generateMeetingSummary = async (transcript: string) => {
    try {
      setIsProcessing(true)

      // In a real implementation, you would use an LLM to generate a summary
      // For this example, we'll create a simple summary
      const summary =
        `Meeting summary for "${meetingTitle}":\n\n` +
        `This meeting covered several topics and resulted in ${actionItems.length} action items. ` +
        `The discussion lasted approximately ${Math.round(transcriptionHistory.length / 2)} minutes.`

      setMeetingSummary(summary)
      setActiveTab("summary")
    } catch (error) {
      console.error("Error generating meeting summary:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const sendActionItemsToNotion = async (items: ActionItem[] = actionItems) => {
    if (!notionSettings.apiKey || !notionSettings.databaseId) {
      alert("Please configure your Notion API key and database ID in settings")
      return
    }

    setIsProcessing(true)

    try {
      // Only send pending items
      const itemsToSend = items.filter((item) => item.status === "pending")

      // Update status to indicate we're processing
      setActionItems((prev) =>
        prev.map((item) => (itemsToSend.some((i) => i.id === item.id) ? { ...item, status: "pending" } : item)),
      )

      // Send items to Notion
      for (const item of itemsToSend) {
        try {
          await sendToNotion({
            apiKey: notionSettings.apiKey,
            databaseId: notionSettings.databaseId,
            title: item.text,
            assignee: item.assignee,
            dueDate: item.dueDate,
            meetingTitle: meetingTitle,
          })

          // Update status to sent
          setActionItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "sent" } : i)))
        } catch (error) {
          console.error(`Error sending action item to Notion:`, error)

          // Update status to error
          setActionItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "error", errorMessage: error instanceof Error ? error.message : "Unknown error" }
                : i,
            ),
          )
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header with Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Input
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            className="max-w-[250px] font-semibold"
            placeholder="Meeting Title"
          />

          <Badge variant={isStreaming ? "destructive" : "outline"}>{isStreaming ? "Recording" : "Not Recording"}</Badge>
        </div>

        <div className="flex space-x-2">
          {isStreaming ? (
            <Button variant="destructive" onClick={stopStreaming} className="flex items-center gap-2">
              <MicOff size={18} />
              Stop
            </Button>
          ) : (
            <Button onClick={startStreaming} className="flex items-center gap-2">
              <Mic size={18} />
              Start
            </Button>
          )}

          <Button
            variant="outline"
            onClick={clearHistory}
            className="flex items-center gap-2"
            disabled={isStreaming && transcriptionHistory.length === 0}
          >
            <Trash size={18} />
            Clear
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Settings size={18} />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Notion Integration Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="notion-api-key">Notion API Key</Label>
                  <Input
                    id="notion-api-key"
                    value={notionSettings.apiKey}
                    onChange={(e) => saveSettings({ ...notionSettings, apiKey: e.target.value })}
                    placeholder="secret_..."
                    type="password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notion-database-id">Notion Database ID</Label>
                  <Input
                    id="notion-database-id"
                    value={notionSettings.databaseId}
                    onChange={(e) => saveSettings({ ...notionSettings, databaseId: e.target.value })}
                    placeholder="123e4567-e89b-12d3-a456-426614174000"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="auto-send" checked={autoSendToNotion} onCheckedChange={setAutoSendToNotion} />
                  <Label htmlFor="auto-send">Automatically send action items to Notion</Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="actions">
            Action Items
            {actionItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {actionItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Transcription Tab */}
        <TabsContent value="transcription" className="space-y-4">
          {/* Current Transcription */}
          <Card className="p-4 min-h-[100px] bg-primary/5 relative">
            <div className="absolute top-2 right-2 text-xs text-muted-foreground">
              {isStreaming ? (
                <span className="flex items-center">
                  <span className="relative flex h-3 w-3 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Recording...
                </span>
              ) : (
                "Not recording"
              )}
            </div>
            <h3 className="font-medium mb-2">Current Transcription</h3>
            <div className="text-lg">
              {currentTranscription || (isStreaming ? "Listening..." : "Press Start to begin transcribing")}
            </div>
          </Card>

          {/* Transcription History */}
          <div>
            <h3 className="font-medium mb-2">Transcription History</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto p-2">
              {transcriptionHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No transcription history yet</p>
              ) : (
                transcriptionHistory.map((item) => (
                  <Card key={item.id} className={`p-3 ${item.isInput ? "bg-primary/10" : "bg-card"}`}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      <span>
                        {item.isInput ? "You" : "Other"} • {item.device}
                      </span>
                    </div>
                    <p>{item.text}</p>
                  </Card>
                ))
              )}
              <div ref={historyEndRef} />
            </div>
          </div>
        </TabsContent>

        {/* Action Items Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Extracted Action Items</h3>
            <Button
              onClick={() => sendActionItemsToNotion()}
              disabled={isProcessing || actionItems.length === 0 || !notionSettings.apiKey}
              className="flex items-center gap-2"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send to Notion
            </Button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto p-2">
            {actionItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No action items detected yet</p>
            ) : (
              actionItems.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="font-medium">{item.text}</div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Assignee:</span>
                          <Select
                            value={item.assignee}
                            onValueChange={(value) => {
                              setActionItems((prev) =>
                                prev.map((i) => (i.id === item.id ? { ...i, assignee: value } : i)),
                              )
                            }}
                          >
                            <SelectTrigger className="h-7 w-[140px]">
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="John">John</SelectItem>
                              <SelectItem value="Sarah">Sarah</SelectItem>
                              <SelectItem value="Mike">Mike</SelectItem>
                              <SelectItem value="Emily">Emily</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Due:</span>
                          <Input
                            type="date"
                            className="h-7 w-[140px]"
                            value={item.dueDate || ""}
                            onChange={(e) => {
                              setActionItems((prev) =>
                                prev.map((i) => (i.id === item.id ? { ...i, dueDate: e.target.value } : i)),
                              )
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      {item.status === "sent" ? (
                        <Badge variant="success" className="flex items-center gap-1">
                          <Check size={12} />
                          Sent
                        </Badge>
                      ) : item.status === "error" ? (
                        <Badge variant="destructive" title={item.errorMessage}>
                          Error
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
            <div ref={actionItemsEndRef} />
          </div>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-medium mb-4">Meeting Summary</h3>
            {isProcessing ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : meetingSummary ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Title</h4>
                  <p className="text-lg font-medium">{meetingTitle}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
                  <Textarea
                    value={meetingSummary}
                    onChange={(e) => setMeetingSummary(e.target.value)}
                    className="min-h-[200px]"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Action Items</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {actionItems.map((item) => (
                      <li key={item.id}>
                        {item.text} {item.assignee ? `(${item.assignee})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button className="w-full">Send Summary to Notion</Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Stop recording to generate a meeting summary</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

