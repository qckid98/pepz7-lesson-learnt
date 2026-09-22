import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * GET /api/profile
 * Get current user's profile
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Update current user's own profile (name, email, password)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: { name?: string; email?: string; username?: string | null; password?: string } = {};

    // Update name
    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
      }
      updateData.name = body.name.trim();
    }

    // Update email
    if (body.email !== undefined) {
      if (!body.email.trim()) {
        return NextResponse.json({ error: "Email tidak boleh kosong" }, { status: 400 });
      }
      // Check if email is taken by another user
      const existing = await db.user.findUnique({ where: { email: body.email.trim() } });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "Email sudah digunakan user lain" }, { status: 409 });
      }
      updateData.email = body.email.trim();
    }

    // Update username
    if (body.username !== undefined) {
      if (body.username && body.username.trim() !== "") {
        const usernameStr = body.username.trim();
        const existing = await db.user.findFirst({ where: { username: usernameStr } });
        if (existing && existing.id !== userId) {
          return NextResponse.json({ error: "Username sudah digunakan user lain" }, { status: 409 });
        }
        updateData.username = usernameStr;
      } else {
        updateData.username = null;
      }
    }

    // Update password (requires current password verification)
    if (body.newPassword !== undefined) {
      if (body.newPassword.length < 6) {
        return NextResponse.json(
          { error: "Password baru minimal 6 karakter" },
          { status: 400 }
        );
      }

      // Verify current password
      if (!body.currentPassword) {
        return NextResponse.json(
          { error: "Masukkan password saat ini untuk ganti password" },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(body.currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json(
          { error: "Password saat ini salah" },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(body.newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
