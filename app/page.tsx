import { MeetingActionAutomator } from "@/components/meeting-action-automator"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Meeting Action Automator</h1>
        <p className="text-center text-muted-foreground mb-8">
          Automatically extract action items from meetings and send them to Notion
        </p>
        <MeetingActionAutomator />
      </div>
    </main>
  )
}

