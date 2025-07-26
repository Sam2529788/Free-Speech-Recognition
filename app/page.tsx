"use client"

import { useState, useRef } from "react"
import { Mic, MicOff, Trash2, Copy, Download, Volume2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function SpeechRecognitionApp() {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { toast } = useToast()

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false)
        setIsTranscribing(true)
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" }) // Use webm for better compatibility

        const formData = new FormData()
        formData.append("audio", audioBlob, "recording.webm")

        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            // Read the response body as text first, then try to parse as JSON
            const rawErrorText = await response.text()
            let errorData: any
            let errorMessage = `Server error: ${response.status} ${response.statusText}`

            try {
              errorData = JSON.parse(rawErrorText)
              errorMessage = errorData.error || errorMessage
            } catch (jsonParseError) {
              // If parsing fails, use the raw text as the error message
              console.error("Server returned non-JSON error response:", rawErrorText)
              errorMessage = `Server returned an unexpected error: ${rawErrorText}. (See console for details)`
            }
            throw new Error(errorMessage)
          }

          const data = await response.json()
          setTranscript(data.transcript)
          toast({
            title: "Transcription Complete",
            description: "Your speech has been successfully transcribed.",
          })
        } catch (error: any) {
          console.error("Client-side transcription error:", error)
          toast({
            title: "Transcription Failed",
            description: error.message || "An unknown error occurred during transcription. Please try again.",
            variant: "destructive",
          })
        } finally {
          setIsTranscribing(false)
          // Stop the microphone stream tracks
          stream.getTracks().forEach((track) => track.stop())
        }
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setTranscript("") // Clear previous transcript
      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone.",
      })
    } catch (error: any) {
      console.error("Microphone access error:", error)
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      toast({
        title: "Recording stopped",
        description: "Transcribing audio...",
      })
    }
  }

  const clearTranscript = () => {
    setTranscript("")
    toast({
      title: "Transcript cleared",
      description: "Ready for new speech recognition",
    })
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      toast({
        title: "Copied to clipboard",
        description: "Transcript has been copied successfully",
      })
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const downloadTranscript = () => {
    const element = document.createElement("a")
    const file = new Blob([transcript], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = `transcript-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    toast({
      title: "Download started",
      description: "Transcript file is being downloaded",
    })
  }

  const speakText = () => {
    if ("speechSynthesis" in window && transcript) {
      const utterance = new SpeechSynthesisUtterance(transcript)
      // For simplicity, we'll use a default or assume English for speech synthesis.
      utterance.lang = "en-US"
      speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Free Speech Recognition</h1>
          <p className="text-lg text-gray-600">High-accuracy speech-to-text conversion using Deepgram</p>
        </div>

        {/* Main Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Speech Recognition Control
            </CardTitle>
            <CardDescription>Click the microphone to start recording. Speak clearly for best results.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Control Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                size="lg"
                className={isRecording ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Transcribing...
                  </>
                ) : isRecording ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>

              <Button onClick={clearTranscript} variant="outline" size="lg" disabled={isRecording || isTranscribing}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>

              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="lg"
                disabled={!transcript || isRecording || isTranscribing}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>

              <Button
                onClick={downloadTranscript}
                variant="outline"
                size="lg"
                disabled={!transcript || isRecording || isTranscribing}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              <Button
                onClick={speakText}
                variant="outline"
                size="lg"
                disabled={!transcript || isRecording || isTranscribing}
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Speak
              </Button>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-4">
              <Badge variant={isRecording ? "default" : "secondary"}>
                {isRecording ? "🔴 Recording" : "⚫ Stopped"}
              </Badge>
              {isTranscribing && (
                <Badge variant="outline" className="animate-pulse">
                  Processing...
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transcript Display */}
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>Your transcribed speech will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[300px] p-4 border rounded-lg bg-white">
              {transcript ? (
                <div className="text-lg leading-relaxed text-gray-900">{transcript}</div>
              ) : isTranscribing ? (
                <div className="text-gray-400 text-center py-20 flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
                  <p>Transcribing your audio...</p>
                </div>
              ) : (
                <div className="text-gray-400 text-center py-20">
                  <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Start Recording" and begin speaking...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">High Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Leverages Deepgram's powerful models for state-of-the-art transcription.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Secure Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Your Deepgram API key is securely handled on the server, never exposed to the client.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Free Tier Available</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Get started with Deepgram's generous free tier for your transcription needs.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Speech recognition powered by Deepgram</p>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
