// ======================================================
// NOVA AI — FILE 4
// worker.js
// Cloudflare Worker Backend
// ======================================================

const ALLOWED_ORIGINS = [
  "https://manav9-arch.github.io",
  "http://localhost",
  "http://127.0.0.1"
];

function getCorsOrigin(request) {
  const origin = request.headers.get("Origin");

  if (!origin) return "*";

  if (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1")
  ) {
    return origin;
  }

  return "null";
}

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

export default {
  async fetch(request, env) {
    // ----------------------------------------------
    // CORS preflight
    // ----------------------------------------------
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    const url = new URL(request.url);

    // ----------------------------------------------
    // Health check
    // ----------------------------------------------
    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "Nova AI Backend",
          status: "online"
        },
        request
      );
    }

    // ----------------------------------------------
    // Chat endpoint
    // ----------------------------------------------
    if (request.method === "POST" && url.pathname === "/chat") {
      try {
        const body = await request.json();

        const message =
          typeof body.message === "string"
            ? body.message.trim()
            : "";

        const messages = Array.isArray(body.messages)
          ? body.messages
          : [];

        const memory =
          typeof body.memory === "string"
            ? body.memory
            : "";

        if (!message) {
          return json(
            {
              ok: false,
              error: "Message is required"
            },
            request,
            400
          );
        }

        // ------------------------------------------
        // API KEY CHECK
        // ------------------------------------------
        if (!env.OPENAI_API_KEY) {
          return json(
            {
              ok: false,
              error: "OPENAI_API_KEY is not configured in Cloudflare."
            },
            request,
            500
          );
        }

        // ------------------------------------------
        // Nova system instructions
        // ------------------------------------------
        const systemPrompt = `
You are Nova AI, a personal AI assistant.

Personality:
- Helpful
- Friendly
- Clear
- Natural
- Can understand Hindi, English and Hinglish.
- Reply in the same language/style the user uses.
- Keep answers practical and easy to understand.

Nova has two layers:

1. Nova Brain
- Conversation
- Context
- Memory
- Personal assistance
- Reasoning
- Future tools

2. JARVIS Control Layer
- Voice commands
- Device actions
- Automation
- Permissions
- Future Android controls

Important:
Do not pretend that you have performed an action if the required tool or permission is not actually available.

User memory:
${memory || "No saved memory yet."}
`;

        // ------------------------------------------
        // Prepare conversation
        // ------------------------------------------
        const conversation = [];

        conversation.push({
          role: "system",
          content: systemPrompt
        });

        // Keep only recent messages
        const recentMessages = messages
          .filter(
            item =>
              item &&
              (item.role === "user" ||
                item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-20);

        for (const item of recentMessages) {
          conversation.push({
            role: item.role,
            content: item.content
          });
        }

        // Make sure current message exists
        if (
          !recentMessages.some(
            item =>
              item.role === "user" &&
              item.content === message
          )
        ) {
          conversation.push({
            role: "user",
            content: message
          });
        }

        // ------------------------------------------
        // OpenAI request
        // ------------------------------------------
        const aiResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: env.OPENAI_MODEL || "gpt-5.6-luna",
              messages: conversation,
              temperature: 0.7
            })
          }
        );

        const aiData = await aiResponse.json();

        // ------------------------------------------
        // AI error
        // ------------------------------------------
        if (!aiResponse.ok) {
          return json(
            {
              ok: false,
              error:
                aiData?.error?.message ||
                "AI service request failed.",
              provider_status: aiResponse.status
            },
            request,
            502
          );
        }

        const reply =
          aiData?.choices?.[0]?.message?.content ||
          "Sorry, Nova could not generate a reply.";

        // ------------------------------------------
        // Final response
        // ------------------------------------------
        return json(
          {
            ok: true,
            reply: reply,
            model:
              aiData?.model ||
              env.OPENAI_MODEL ||
              "gpt-5.6-luna"
          },
          request
        );

      } catch (error) {
        return json(
          {
            ok: false,
            error: "Nova backend error.",
            details: error?.message || "Unknown error"
          },
          request,
          500
        );
      }
    }

    // ----------------------------------------------
    // Unknown route
    // ----------------------------------------------
    return json(
      {
        ok: false,
        error: "Route not found"
      },
      request,
      404
    );
  }
};
