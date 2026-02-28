"""
Pydantic models for whiteboard commands. Matches frontend applyCommand() and prompt.js.
Used for LangChain structured output so Gemini returns valid JSON.
"""
from __future__ import annotations
from typing import Literal, Union, Optional, List
from pydantic import BaseModel, Field


# Canvas: 800x600, center (400, 300)
CENTER_X = 400
CENTER_Y = 300


class DrawCommand(BaseModel):
    type: Literal["DRAW"] = "DRAW"
    shape: Literal["circle", "rectangle"]
    x: int = CENTER_X
    y: int = CENTER_Y
    radius: Optional[int] = None  # circle
    width: Optional[int] = None  # rectangle
    height: Optional[int] = None
    color: str = "black"


class WriteCommand(BaseModel):
    type: Literal["WRITE"] = "WRITE"
    text: str
    x: int = CENTER_X
    y: int = CENTER_Y
    fontSize: int = 24
    color: str = "black"


class MoveCommand(BaseModel):
    type: Literal["MOVE"] = "MOVE"
    id: str
    x: Optional[int] = None
    y: Optional[int] = None
    deltaX: Optional[int] = None
    deltaY: Optional[int] = None


class ResizeCommand(BaseModel):
    type: Literal["RESIZE"] = "RESIZE"
    id: str
    scale: float


class RotateCommand(BaseModel):
    type: Literal["ROTATE"] = "ROTATE"
    id: str
    degrees: Union[int, float]


class DeleteCommand(BaseModel):
    type: Literal["DELETE"] = "DELETE"
    id: str


class ClearCommand(BaseModel):
    type: Literal["CLEAR"] = "CLEAR"


class ErrorCommand(BaseModel):
    type: Literal["ERROR"] = "ERROR"
    reason: str = "unclear"


WhiteboardCommand = Union[
    DrawCommand,
    WriteCommand,
    MoveCommand,
    ResizeCommand,
    RotateCommand,
    DeleteCommand,
    ClearCommand,
    ErrorCommand,
]


class ParseResponse(BaseModel):
    """Response from the parser: one or more commands (or a single ERROR)."""
    commands: List[WhiteboardCommand] = Field(description="List of whiteboard commands to execute in order")
