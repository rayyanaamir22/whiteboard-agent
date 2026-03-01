"""
Pydantic models for whiteboard commands. Matches frontend applyCommand() and prompt.js.
Used for LangChain structured output so Gemini returns valid JSON.
"""
from __future__ import annotations
from typing import Literal, Union, Optional, List, Annotated
from pydantic import BaseModel, Field
from pydantic import ConfigDict

# Ignore extra keys from Gemini so we don't fail on minor schema drift
_model_extra = ConfigDict(extra="ignore")


# Canvas: 800x600, center (400, 300)
CENTER_X = 400
CENTER_Y = 300


class DrawCommand(BaseModel):
    model_config = _model_extra
    type: Literal["DRAW"] = "DRAW"
    shape: Literal[
        "circle",
        "rectangle",
        "arc",
        "arrow",
        "line",
        "ring",
        "star",
        "wedge",
    ]
    x: int = CENTER_X
    y: int = CENTER_Y
    radius: Optional[int] = None  # circle, wedge
    width: Optional[int] = None  # rectangle
    height: Optional[int] = None
    # arc / ring: innerRadius, outerRadius, angle (degrees)
    innerRadius: Optional[int] = None
    outerRadius: Optional[int] = None
    angle: Optional[Union[int, float]] = None
    # star: numPoints, innerRadius, outerRadius
    numPoints: Optional[int] = None
    # line / arrow: flat list [x1,y1, x2,y2, ...] (absolute coords)
    points: Optional[List[Union[int, float]]] = None
    pointerLength: Optional[int] = None  # arrow
    pointerWidth: Optional[int] = None  # arrow
    color: str = "black"


class WriteCommand(BaseModel):
    model_config = _model_extra
    type: Literal["WRITE"] = "WRITE"
    text: str
    x: int = CENTER_X
    y: int = CENTER_Y
    fontSize: int = 24
    color: str = "black"


class MoveCommand(BaseModel):
    model_config = _model_extra
    type: Literal["MOVE"] = "MOVE"
    id: str
    x: Optional[int] = None
    y: Optional[int] = None
    deltaX: Optional[int] = None
    deltaY: Optional[int] = None


class ResizeCommand(BaseModel):
    model_config = _model_extra
    type: Literal["RESIZE"] = "RESIZE"
    id: str
    scale: float


class RotateCommand(BaseModel):
    model_config = _model_extra
    type: Literal["ROTATE"] = "ROTATE"
    id: str
    degrees: Union[int, float]


class DeleteCommand(BaseModel):
    model_config = _model_extra
    type: Literal["DELETE"] = "DELETE"
    id: str


class ClearCommand(BaseModel):
    model_config = _model_extra
    type: Literal["CLEAR"] = "CLEAR"


class ErrorCommand(BaseModel):
    model_config = _model_extra
    type: Literal["ERROR"] = "ERROR"
    reason: str = "unclear"


WhiteboardCommand = Annotated[
    Union[
    DrawCommand,
    WriteCommand,
    MoveCommand,
    ResizeCommand,
    RotateCommand,
    DeleteCommand,
    ClearCommand,
    ErrorCommand,
    ],
    Field(discriminator="type"),
]


class ParseResponse(BaseModel):
    """Response from the parser: one or more commands (or a single ERROR)."""
    commands: List[WhiteboardCommand] = Field(description="List of whiteboard commands to execute in order")
