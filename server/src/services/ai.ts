import type { Room, Item } from '../types/index.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Clean a frame string by removing markdown code blocks and trimming whitespace
 */
function cleanFrame(str: string): string {
  if (typeof str !== 'string') {
    return String(str);
  }
  
  let cleaned = str;
  
  // Remove markdown code blocks (```ascii, ```json, ```)
  cleaned = cleaned.replace(/```ascii\s*/gi, '');
  cleaned = cleaned.replace(/```json\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Core function to generate ASCII art using OpenAI API
 */
export async function generateAscii(systemPrompt: string, userContext: string): Promise<string[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContext,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from OpenAI API');
  }

  // Parse JSON response
  try {
    const json = JSON.parse(content);
    
    // Handle different JSON structures: frames (array), art (string), tapestry (string)
    let frames: string[] = [];
    
    if (json.frames && Array.isArray(json.frames)) {
      // Standard format: array of frames
      frames = json.frames.map((frame: unknown) => cleanFrame(String(frame))).filter((frame: string) => frame.length > 0);
    } else if (json.art && typeof json.art === 'string') {
      // Single art string (for tapestries)
      frames = [cleanFrame(json.art)];
    } else if (json.tapestry && typeof json.tapestry === 'string') {
      // Alternative tapestry field
      frames = [cleanFrame(json.tapestry)];
    } else {
      // Fallback: log and return empty array
      console.warn('Invalid JSON structure. Expected "frames" (array), "art" (string), or "tapestry" (string):', json);
      return [];
    }
    
    if (frames.length === 0) {
      console.warn('No valid frames found after cleaning:', json);
      return [];
    }
    
    return frames;
  } catch (error) {
    console.warn('JSON Parse failed, attempted rescue.');
    console.error('Failed to parse JSON response:', error);
    
    // Attempt to rescue truncated/malformed JSON
    try {
      // Try to rescue tapestries (looking for "art" field)
      // Match "art": " and capture everything after (handles truncated strings without closing quote)
      const artMatch = content.match(/"art"\s*:\s*"(.*?)(?:"|$)/s);
      if (artMatch && artMatch[1]) {
        let rescuedArt = artMatch[1];
        // Unescape any escaped characters (handle \n, \", \\)
        rescuedArt = rescuedArt.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        // Safety cap: truncate to ~2000 characters (60 chars * 30 rows + newlines = ~1830, so 2000 is safe)
        if (rescuedArt.length > 2000) {
          // Try to truncate at a newline boundary
          const truncated = rescuedArt.substring(0, 2000);
          const lastNewline = truncated.lastIndexOf('\n');
          rescuedArt = lastNewline > 0 ? truncated.substring(0, lastNewline) : truncated;
          console.warn('Rescued art truncated to 2000 characters');
        }
        return [cleanFrame(rescuedArt)];
      }
      
      // Try to rescue animations (looking for "frames" array)
      const framesMatch = content.match(/"frames"\s*:\s*\[(.*?)\]/s);
      if (framesMatch && framesMatch[1]) {
        // Animations are harder to rescue - just return empty array
        console.warn('Frames array found but could not be fully parsed');
        return [];
      }
    } catch (rescueError) {
      console.error('Rescue attempt also failed:', rescueError);
    }
    
    console.error('Raw content length:', content.length);
    console.error('Raw content preview:', content.substring(0, 500));
    return [];
  }
}

/**
 * Generate a room tapestry (static ASCII art for room display)
 */
export async function generateRoomTapestry(room: Room, objects: Item[], mood: string): Promise<string[]> {
  const systemPrompt = `You are an Abstract Texture Generator. Output JSON only.

Schema: { "art": "STRING_WITH_NEWLINES" }

CRITICAL VISUAL RULES:

1. USE ONLY THESE CHARACTERS: (space) ░ ▒ ▓ █

2. DO NOT DRAW OBJECTS. No trees, no walls, no outlines. Just a seamless texture block.

3. CREATE GRADIENTS. Use density to represent the "Mood".

   - Dark/Heavy Moods: Mostly ▓ and █.

   - Light/Ethereal Moods: Mostly ░ and (space).

4. FILL THE FRAME. 40x20 characters. 100% filled (use space for "white" areas).

5. ABSTRACTION. The art should look like a "noise field" or "dithering pattern" from 1980s computing.

6. SEAMLESS. The texture should be seamless and tileable - no obvious edges or patterns.

CRITICAL FORMATTING RULES:

1. The "art" field must be a SINGLE string.
2. Use "\\n" for line breaks within the string.
3. DO NOT return an array of lines.
4. DO NOT use markdown code blocks (\`\`\`) inside the string.

CRITICAL SIZE LIMITS:

1. EXACTLY 20 ROWS. STOP EXACTLY AT 20 ROWS.
2. Each row is exactly 40 characters (no newline in the string, just \\n).
3. Total: 20 rows × 40 characters = 800 characters + 19 newlines = 819 characters max.
4. Do not generate an infinite stream of texture. Stop at 20 rows.`;

  const userPrompt = `Create a seamless 40x20 texture block representing this room's mood:

ROOM DETAILS:
Title: ${room.title}
Mood: ${mood}
Shroud Level: ${room.shroud_level} (0=clear, 5=very mysterious)

INSTRUCTIONS:
- Generate a seamless texture block using ONLY block characters: ░ ▒ ▓ █ and space
- Use density to represent the mood: ${mood}
- Higher shroud level (${room.shroud_level}) = darker/more dense (more ▓ and █)
- Lower shroud level = lighter/more sparse (more ░ and space)
- Create a 40x20 dithering pattern that evokes the mood
- NO objects, NO scenes, NO outlines - just a seamless block of texture
- CRITICAL: Generate EXACTLY 20 rows of 40 characters each. STOP at row 20.`;

  return generateAscii(systemPrompt, userPrompt);
}

/**
 * Generate an object interaction animation (3-frame sequence)
 */
export async function generateObjectInteraction(item: Item): Promise<string[]> {
  const systemPrompt = `You are a Retro Icon Animator. Output JSON only.

Schema: { "frames": ["str1", "str2", "str3"] }

CRITICAL RULES:

1. NO TEXT. Do not write the name of the object. Do not include descriptions.

2. DRAW ICONS. Draw a centered, symmetrical, 15x15 icon.

3. ANIMATE THE OUTCOME.

   - Frame 1: The Object (Static).

   - Frame 2: The Action (Interaction Verb).

   - Frame 3: The Result (Success Message).

4. USE SYMBOLS. Use * for magic, # for solid, = for motion.

CRITICAL FORMATTING RULES:

1. Return exactly 3 strings in the frames array.
2. Each string is a FULL frame (40x15 characters).
3. Use "\\n" for line breaks within each frame string.
4. DO NOT split a single frame into multiple array elements.
5. DO NOT use markdown code blocks (\`\`\`) inside the strings.
6. Center the icon in each frame using spaces.
7. Keep the icon large and prominent - it should dominate the frame.

CRITICAL SIZE LIMITS:

1. Keep frames concise (max 15 rows per frame).
2. Each frame should be compact and focused on the icon.
3. Do not generate excessive content - keep it minimal and readable.`;

  const userPrompt = `Create a 3-frame ASCII icon animation showing interaction with an object:

OBJECT DETAILS:
Name: ${item.name}
Interaction Verb: ${item.interact_verb}
Outcome/Success Message: "${item.success_message || 'No success message'}"

ANIMATION SEQUENCE:
Frame 1: Draw the object as a large, centered, symmetrical icon (NO TEXT LABELS)
Frame 2: Show the action "${item.interact_verb}" - animate the icon with motion effects (use * for magic, = for motion, # for solid)
Frame 3: MUST visualize the Success Message: "${item.success_message || item.interact_verb}" - if it says "opens", show it open; if it says "glows", show it glowing; etc.

CRITICAL: Frame 3 MUST depict the outcome described in the Success Message. Do not include any text labels - only visual symbols and icons.`;

  return generateAscii(systemPrompt, userPrompt);
}

/**
 * Generate a room symbol (emoji) for the map
 */
export async function generateRoomSymbol(room: Room, mood: string): Promise<string> {
  const systemPrompt = `You are a Cartographer for a retro RPG. Output JSON only.

Schema: { "symbol": "EMOJI_STRING" }

RULES:

1. Output exactly 1 emoji that best represents the room.

2. NO TEXT. NO NUMBERS. JUST EMOJIS.

3. Examples:

   - "Volcanic Forge" -> "🌋"

   - "Silent Forest" -> "🌲"

   - "The Void" -> "⚫"

   - "Ancient Temple" -> "🏛️"

   - "Peaceful Meadow" -> "🌾"

CRITICAL FORMATTING RULES:

1. The "symbol" field must be a SINGLE string containing 1-2 emojis.
2. DO NOT use markdown code blocks (\`\`\`) inside the string.
3. DO NOT include any text or numbers - only a single emoji character.`;

  const userPrompt = `Generate a map symbol (1 emoji) for this room:

ROOM DETAILS:
Title: ${room.title}
Description: ${room.description}
Mood: ${mood}
Shroud Level: ${room.shroud_level} (0=clear, 5=very mysterious)

INSTRUCTIONS:
- Choose 1 emoji that best represent the room's essence
- Consider the title, description, and mood
- Higher shroud level = more mysterious/obscured symbols
- Output ONLY an emoji, no text`;

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI API');
    }

    // Parse JSON response
    try {
      const json = JSON.parse(content);
      
      if (json.symbol && typeof json.symbol === 'string') {
        return cleanFrame(json.symbol).trim();
      }
      
      console.warn('Invalid JSON structure. Expected "symbol" (string):', json);
      return '📍';
    } catch (error) {
      console.warn('JSON Parse failed for room symbol:', error);
      // Try to rescue
      const symbolMatch = content.match(/"symbol"\s*:\s*"(.*?)"/);
      if (symbolMatch && symbolMatch[1]) {
        return cleanFrame(symbolMatch[1]).trim();
      }
      return '📍';
    }
  } catch (error) {
    console.error('Failed to generate room symbol:', error);
    return '📍';
  }
}

