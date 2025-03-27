"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, MicOff, Trash } from "lucide-react"
import { pipe } from "@screenpipe/browser"

interface TranscriptionChunk {
  id: string
  text: string
  timestamp: string
  isInput: boolean
  device: string
}

export function TranscriptionStreamer() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState("")
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionChunk[]>([])
  const streamRef = useRef<any>(null)
  const historyEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when history updates
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [transcriptionHistory])

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.return()
      }
    }
  }, [])

  const startStreaming = async () => {
    try {
      setIsStreaming(true)
      setCurrentTranscription("")

      // Create a buffer for the current chunk
      let currentChunk = ""
      let chunkStartTime = new Date()

      // Start streaming transcriptions
      const stream = pipe.streamTranscriptions()
      streamRef.current = stream

      for await (const chunk of stream) {
        const text = chunk.choices[0].text
        const metadata = chunk.metadata || {}

        // Update current transcription
        setCurrentTranscription((prev) => prev + text)
        currentChunk += text

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

    setIsStreaming(false)
  }

  const clearHistory = () => {
    setTranscriptionHistory([])
    setCurrentTranscription("")
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Audio Transcription</h2>
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
        </div>
      </div>

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
    </div>
  )
}

