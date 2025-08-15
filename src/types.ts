export interface WebSocketMessage {
  type: "join_room" | "leave_room" | "drawing_update" | "drawing_delete" | "cursor_move" | "chat"
  roomId: string
  element?: DrawingElement
  elementId?: string
  cursor?: CursorPosition
  message?: string
}

export interface DrawingElement {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  points?: any
  strokeColor: string
  strokeWidth: number
  fillColor: string
  strokeStyle?: string
  text?: string
  userId: string
  timestamp: number
}

export interface CursorPosition {
  x: number
  y: number
  userId: string
}
