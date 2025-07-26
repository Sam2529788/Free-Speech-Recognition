import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured for Deepgram
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY
    if (!deepgramApiKey) {
      console.error("Server Error: DEEPGRAM_API_KEY environment variable not set.")
      return NextResponse.json(
        { error: "Deepgram API Key not configured. Please set DEEPGRAM_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Parse the incoming FormData
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File | null

    if (!audioFile) {
      console.error("Server Error: No audio file provided in request.")
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 })
    }

    // Basic validation for file type
    if (!audioFile.type.startsWith("audio/")) {
      console.error("Server Error: Invalid file type provided:", audioFile.type)
      return NextResponse.json({ error: "Invalid file type. Only audio files are supported." }, { status: 400 })
    }

    // Convert File to ArrayBuffer for direct fetch
    const audioBuffer = await audioFile.arrayBuffer()

    console.log("Received audio file:", audioFile.name, audioFile.type, audioFile.size, "bytes")
    console.log(
      "Sending request to Deepgram:",
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
    )
    console.log("Headers:", {
      Authorization: `Token [API Key Masked]`, // Mask key for logs
      "Content-Type": audioFile.type,
    })
    console.log("Body size:", audioBuffer.byteLength, "bytes")

    // Send raw audio data directly to Deepgram's transcription endpoint
    const deepgramResponse = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramApiKey}`, // Deepgram requires "Token " prefix
          "Content-Type": audioFile.type, // Use the actual mimetype from the recorded audio
        },
        body: audioBuffer, // Send the raw audio buffer
      },
    )

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text()
      console.error("Deepgram API returned an error:", deepgramResponse.status, errorText)
      try {
        const errorJson = JSON.parse(errorText)
        return NextResponse.json(
          { error: errorJson.error || errorJson.message || "Deepgram API error" },
          { status: deepgramResponse.status },
        )
      } catch {
        return NextResponse.json({ error: `Deepgram API error: ${errorText}` }, { status: deepgramResponse.status })
      }
    }

    const deepgramData = await deepgramResponse.json()

    // Deepgram's response structure for prerecorded audio
    const transcription = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""

    if (!transcription) {
      console.warn("Deepgram returned no transcription text.")
      return NextResponse.json({ error: "No transcript could be generated from the audio." }, { status: 404 })
    }

    return NextResponse.json({ transcript: transcription })
  } catch (error: any) {
    console.error("Server-side transcription error:", error) // Log the full error object for debugging

    let errorMessage = "An unexpected server error occurred during transcription."
    const statusCode = 500

    if (error.message) {
      errorMessage = `Transcription failed: ${error.message}`
    } else {
      // Fallback for truly unknown errors, stringify the error object
      errorMessage = `An unknown error occurred: ${JSON.stringify(error)}`
    }

    // Ensure we always return a JSON response
    return NextResponse.json({ error: errorMessage }, { status: statusCode })
  }
}
