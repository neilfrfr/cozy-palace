"use client";
import { deleteMenuItemAction } from "@/app/actions/orders";
export function DeleteMenuItem({ id, name }: { id: string; name: string }) {
  return <form action={deleteMenuItemAction} onSubmit={(event) => { if (!window.confirm(`Delete ${name}? Items already in saved orders cannot be deleted.`)) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><button className="button secondary delete-menu-item">Delete</button></form>;
}
