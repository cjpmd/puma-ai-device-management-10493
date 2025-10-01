
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { videoId, frameNumber, frameData } = await req.json()
    
    console.log('Processing video frame:', { videoId, frameNumber })
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    console.log('Processing video frame:', { videoId, frameNumber })

    // Process frame data using TensorFlow.js
    // Note: In a production environment, you'd want to use a more robust ML pipeline
    const detections = await processFrame(frameData)

    console.log('Generated detections:', detections)

    // Store detections without player_id for now
    const { error } = await supabase
      .from('player_tracking')
      .insert(detections.map(detection => ({
        video_id: videoId,
        frame_number: frameNumber,
        x_coord: detection.x,
        y_coord: detection.y,
        confidence: detection.confidence
      })))

    if (error) {
      console.error('Error storing detections:', error)
      throw error
    }

    console.log('Successfully stored detections')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error processing request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function processFrame(frameData: string) {
  // Mock data with just coordinates and confidence, without player_id
  return [{
    x: Math.random() * 100,
    y: Math.random() * 100,
    confidence: 0.95
  }]
}
