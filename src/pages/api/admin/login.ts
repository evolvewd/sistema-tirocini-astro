import type { APIRoute } from "astro";

const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || "administrator2025";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password } = await request.json();

    if (!password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password richiesta",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (password === ADMIN_PASSWORD) {
      const token = `admin_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2)}`;

      return new Response(
        JSON.stringify({
          success: true,
          token: token,
          message: "Login effettuato con successo",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password errata",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in admin login:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Errore interno del server",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
