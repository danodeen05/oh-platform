/**
 * Chappy Chopstix - AI Ordering Assistant
 *
 * Core agentic loop powered by Claude API with tool use.
 * Handles conversations across SMS/RCS and Web Chat channels.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getChappySystemPrompt } from "./prompts.js";
import { CHAPPY_TOOLS, executeTools } from "./tools.js";
import { formatForRCS, formatForSMS } from "./formatters/rcs.js";
import { formatForWeb } from "./formatters/web.js";

// Initialize Anthropic client
const anthropic = new Anthropic();

// Model configuration
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

/**
 * Clean up conversation history to remove orphaned tool_result blocks
 * This can happen when a stream is interrupted during tool execution
 */
function cleanupMessageHistory(messages) {
  if (!messages || messages.length === 0) return [];

  // Collect all tool_use IDs from assistant messages
  const toolUseIds = new Set();
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "tool_use") {
          toolUseIds.add(block.id);
        }
      }
    }
  }

  // Filter out orphaned tool_result blocks from user messages
  return messages.map((msg) => {
    if (msg.role === "user" && Array.isArray(msg.content)) {
      const filteredContent = msg.content.filter((block) => {
        if (block.type === "tool_result") {
          return toolUseIds.has(block.tool_use_id);
        }
        return true;
      });
      // If all content was filtered out, keep at least a placeholder
      if (filteredContent.length === 0) {
        return { ...msg, content: [{ type: "text", text: "(previous message)" }] };
      }
      return { ...msg, content: filteredContent };
    }
    return msg;
  }).filter((msg) => {
    // Remove empty messages
    if (Array.isArray(msg.content) && msg.content.length === 0) return false;
    return true;
  });
}

/**
 * Main conversation handler for Chappy
 *
 * @param {Object} params
 * @param {string} params.channel - "sms" | "rcs" | "web"
 * @param {string} params.identifier - Phone number (SMS) or userId/guestId (web)
 * @param {string} params.message - User's message text
 * @param {Object} params.context - Additional context (user data, location, etc.)
 * @param {Object} params.prisma - Prisma client instance
 * @returns {Object} - { text, rcsPayload?, actions? }
 */
export async function handleChappyConversation({
  channel,
  identifier,
  message,
  context = {},
  prisma,
}) {
  // Load or create conversation history
  const conversation = await loadOrCreateConversation(prisma, identifier, channel);

  // Parse and clean up conversation history (remove orphaned tool_result blocks)
  const history = cleanupMessageHistory(conversation.messages || []);

  // Add user message to history
  history.push({
    role: "user",
    content: message,
  });

  // Build system prompt with context
  const systemPrompt = getChappySystemPrompt({
    channel,
    user: context.user,
    guest: context.guest,
    location: context.location,
    currentCart: context.currentCart,
  });

  // Create context for tool execution
  const toolContext = {
    prisma,
    userId: context.user?.id,
    guestId: context.guest?.id,
    locationId: context.location?.id,
    tenantId: context.tenantId || "oh", // Default to Oh! tenant
  };

  // Call Claude with tools
  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    tools: CHAPPY_TOOLS,
    messages: history,
  });

  // Agentic loop - execute tools until Claude is done
  while (response.stop_reason === "tool_use") {
    // Extract tool use blocks
    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );

    // Execute all tools and collect results
    const toolResults = await executeTools(toolUseBlocks, toolContext);

    // Add assistant response to history
    history.push({
      role: "assistant",
      content: response.content,
    });

    // Add tool results as user message
    history.push({
      role: "user",
      content: toolResults,
    });

    // Get Claude's next response
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: CHAPPY_TOOLS,
      messages: history,
    });
  }

  // Extract final text response
  const textBlock = response.content.find((block) => block.type === "text");
  const textResponse = textBlock?.text || "I'm having trouble understanding. Can you try again?";

  // Add final assistant response to history
  history.push({
    role: "assistant",
    content: response.content,
  });

  // Save updated conversation
  await saveConversation(prisma, conversation.id, history);

  // Format response based on channel
  let formattedResponse;
  switch (channel) {
    case "rcs":
      formattedResponse = formatForRCS(textResponse, response.content);
      break;
    case "sms":
      formattedResponse = formatForSMS(textResponse);
      break;
    case "web":
      formattedResponse = formatForWeb(textResponse, response.content);
      break;
    default:
      formattedResponse = { text: textResponse };
  }

  return formattedResponse;
}

/**
 * Load existing conversation or create new one
 */
async function loadOrCreateConversation(prisma, identifier, channel) {
  // Try to find existing active conversation
  let conversation = await prisma.chappyConversation.findFirst({
    where: {
      identifier,
      channel,
      isActive: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Create new conversation if none exists or last one is stale (>30 min)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (!conversation || conversation.updatedAt < thirtyMinutesAgo) {
    conversation = await prisma.chappyConversation.create({
      data: {
        identifier,
        channel,
        messages: [],
        isActive: true,
      },
    });
  }

  return conversation;
}

/**
 * Save conversation history
 */
async function saveConversation(prisma, conversationId, messages) {
  // Keep only last 20 messages to manage context window
  const trimmedMessages = messages.slice(-20);

  await prisma.chappyConversation.update({
    where: { id: conversationId },
    data: {
      messages: trimmedMessages,
      updatedAt: new Date(),
    },
  });
}

/**
 * Reset/clear a conversation (for STOP command or user request)
 */
export async function resetConversation(prisma, identifier, channel) {
  await prisma.chappyConversation.updateMany({
    where: {
      identifier,
      channel,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
}

/**
 * Handle special keywords (STOP, HELP)
 * Returns true if keyword was handled, false otherwise
 */
export function handleSpecialKeywords(message) {
  const normalized = message.trim().toUpperCase();

  if (normalized === "STOP") {
    return {
      handled: true,
      response: "You've been unsubscribed from Oh! Beef Noodle Soup messages. Text START to resubscribe.",
      action: "UNSUBSCRIBE",
    };
  }

  if (normalized === "HELP") {
    return {
      handled: true,
      response: "Oh! Beef Noodle Soup: Text to order, check points, or get recommendations. Reply STOP to unsubscribe. Msg&data rates may apply. Contact: hello@ohbeef.com",
      action: "HELP",
    };
  }

  if (normalized === "START") {
    return {
      handled: true,
      response: "Welcome back! I'm Chappy, your Oh! ordering assistant. How can I help you today?",
      action: "RESUBSCRIBE",
    };
  }

  return { handled: false };
}

/**
 * Streaming conversation handler for Chappy
 * Uses Claude's streaming API and yields chunks for SSE
 *
 * @param {Object} params - Same as handleChappyConversation
 * @yields {Object} - Chunks of type { type, data }
 */
export async function* handleChappyConversationStream({
  channel,
  identifier,
  message,
  context = {},
  prisma,
}) {
  // Load or create conversation history
  const conversation = await loadOrCreateConversation(prisma, identifier, channel);

  // Parse and clean up conversation history (remove orphaned tool_result blocks)
  const history = cleanupMessageHistory(conversation.messages || []);

  // Add user message to history
  history.push({
    role: "user",
    content: message,
  });

  // Build system prompt with context
  const systemPrompt = getChappySystemPrompt({
    channel,
    user: context.user,
    guest: context.guest,
    location: context.location,
    currentCart: context.currentCart,
  });

  // Create context for tool execution
  const toolContext = {
    prisma,
    userId: context.user?.id,
    guestId: context.guest?.id,
    locationId: context.location?.id,
    tenantId: context.tenantId || "oh",
  };

  // Track Apple Pay order if created during conversation
  let applePayOrder = null;

  // Yield thinking indicator
  yield { type: "thinking", data: { status: "started" } };

  // Start with streaming API call
  let stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    tools: CHAPPY_TOOLS,
    messages: history,
  });

  let accumulatedText = "";
  let toolUseBlocks = [];
  let responseContent = [];

  // Process the stream
  for await (const event of stream) {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "text") {
        // Starting text block
      } else if (event.content_block.type === "tool_use") {
        // Starting tool use
        yield {
          type: "tool_start",
          data: {
            toolName: event.content_block.name,
            toolId: event.content_block.id
          }
        };
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        // Stream text chunks
        accumulatedText += event.delta.text;
        yield { type: "text", data: { text: event.delta.text } };
      } else if (event.delta.type === "input_json_delta") {
        // Accumulating tool input (don't stream this)
      }
    }
  }

  // Get final message to check for tool use
  let response = await stream.finalMessage();
  responseContent = response.content;

  // Agentic loop - handle tool use
  while (response.stop_reason === "tool_use") {
    toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );

    // Yield tool execution status
    for (const tool of toolUseBlocks) {
      yield {
        type: "tool_executing",
        data: {
          toolName: tool.name,
          toolId: tool.id
        }
      };
    }

    // Execute all tools
    const toolResults = await executeTools(toolUseBlocks, toolContext);

    // Check for Apple Pay order in tool results
    for (const result of toolResults) {
      try {
        const content = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
        if (content.requiresApplePay && content.clientSecret) {
          applePayOrder = {
            orderId: content.orderId,
            orderNumber: content.orderNumber,
            clientSecret: content.clientSecret,
            totalCents: content.totalCents,
            locationName: content.locationName,
          };
        }
      } catch (e) {
        // Not JSON or no Apple Pay data
      }
    }

    // Yield tool results status
    yield { type: "tool_complete", data: { count: toolUseBlocks.length } };

    // Add to history
    history.push({
      role: "assistant",
      content: response.content,
    });
    history.push({
      role: "user",
      content: toolResults,
    });

    // Continue with next streaming call
    accumulatedText = "";
    stream = await anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: CHAPPY_TOOLS,
      messages: history,
    });

    // Process this stream
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          yield {
            type: "tool_start",
            data: {
              toolName: event.content_block.name,
              toolId: event.content_block.id
            }
          };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          accumulatedText += event.delta.text;
          yield { type: "text", data: { text: event.delta.text } };
        }
      }
    }

    response = await stream.finalMessage();
    responseContent = response.content;
  }

  // Extract final text
  const textBlock = responseContent.find((block) => block.type === "text");
  const finalText = textBlock?.text || accumulatedText;

  // Add final response to history
  history.push({
    role: "assistant",
    content: responseContent,
  });

  // Save conversation
  await saveConversation(prisma, conversation.id, history);

  // Format final response for web
  const formattedResponse = formatForWeb(finalText, responseContent);

  // Include Apple Pay order data if present
  if (applePayOrder) {
    formattedResponse.applePayOrder = applePayOrder;
  }

  // Yield done event with formatted data
  yield {
    type: "done",
    data: formattedResponse
  };
}

export default {
  handleChappyConversation,
  handleChappyConversationStream,
  resetConversation,
  handleSpecialKeywords,
};
