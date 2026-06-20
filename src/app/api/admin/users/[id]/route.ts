import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * PATCH /api/admin/users/[id]
 * Update user (name, email, role, password) — Admin only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      email?: string;
      role?: "ADMIN" | "VIEWER";
      password?: string;
    } = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updateData.name = body.name.trim();
    }

    if (body.email !== undefined) {
      if (!body.email.trim()) {
        return NextResponse.json({ error: "Email cannot be empty" }, { status: 400 });
      }
      // Check if email is taken by another user
      const existing = await db.user.findUnique({ where: { email: body.email.trim() } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      updateData.email = body.email.trim();
    }

    if (body.role !== undefined) {
      if (body.role !== "ADMIN" && body.role !== "VIEWER") {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      // Prevent demoting yourself
      if (id === session.user.id && body.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Cannot change your own role" },
          { status: 400 }
        );
      }
      updateData.role = body.role;
    }

    if (body.password !== undefined) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(body.password, 12);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
