import { FastifyRequest, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/index.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: string;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ user: AuthenticatedUser; session: any } | null> {
  try {
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });

    if (!session || !session.user) {
      reply.status(401).send({ error: "Unauthorized. Please sign in to access this resource." });
      return null;
    }

    return {
      user: session.user as unknown as AuthenticatedUser,
      session: session.session,
    };
  } catch (error) {
    reply.status(401).send({ error: "Invalid session or unauthorized." });
    return null;
  }
}
