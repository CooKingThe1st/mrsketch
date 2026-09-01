from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel, Field

class MacroDefinition(BaseModel):
    command: str
    argsCount: int = 0
    template: str

class PrimitiveConfig(BaseModel):
    id: Optional[str] = None
    type: Optional[str] = None
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    width: Optional[float] = None
    height: Optional[float] = None
    radius: Optional[float] = None
    triangleType: Optional[str] = 'right_isosceles'
    vertices: Optional[List[List[float]]] = None
    points: Optional[List[float]] = None
    strokeColor: Optional[str] = None
    fillColor: Optional[str] = None
    strokeOpacity: Optional[float] = 1.0
    fillOpacity: Optional[float] = 1.0
    controlPoint: Optional[List[float]] = None
    lineShape: Optional[str] = 'curve'
    doubleArrow: Optional[bool] = False
    arrowSize: Optional[float] = 1.0
    strokeWidth: Optional[float] = None
    strokeStyle: Optional[str] = None

class PrimitiveDefinition(BaseModel):
    id: Optional[str] = None
    type: str # 'circle' | 'rect' | 'poly' | 'line' | 'vector'
    config: PrimitiveConfig

class RobotDefinition(BaseModel):
    id: str
    name: str
    primitives: List[PrimitiveDefinition] = []

class NodeStyle(BaseModel):
    strokeWidth: float = 2.0
    strokeStyle: str = 'solid'
    color: str = '#3b82f6'
    fillColor: Optional[str] = '#dbeafe'
    strokeOpacity: Optional[float] = 1.0
    fillOpacity: Optional[float] = 1.0

class SceneNode(BaseModel):
    id: str
    name: Optional[str] = None
    type: str # 'alias' | 'obstacle' | 'vector' | 'line' | 'rect' | 'circle' | 'poly' | 'text'
    definitionId: Optional[str] = None
    x: float = 0.0
    y: float = 0.0
    scale: Optional[float] = 1.0
    scaleX: Optional[float] = 1.0
    scaleY: Optional[float] = 1.0
    rotation: float = 0.0
    width: Optional[float] = None
    height: Optional[float] = None
    radius: Optional[float] = None
    triangleType: Optional[str] = 'right_isosceles'
    points: Optional[List[float]] = None
    controlPoint: Optional[List[float]] = None
    lineShape: Optional[str] = 'curve'
    doubleArrow: Optional[bool] = False
    arrowSize: Optional[float] = 1.0
    vertices: Optional[List[List[float]]] = None
    startBinding: Optional[Dict[str, Any]] = None
    endBinding: Optional[Dict[str, Any]] = None
    controlBinding: Optional[Dict[str, Any]] = None
    megaBindings: Optional[Dict[Any, Any]] = None
    label: Optional[str] = None
    labelOffsetX: Optional[float] = 0.3
    labelOffsetY: Optional[float] = 0.3
    labelFillTransparent: Optional[bool] = True
    labelFillColor: Optional[str] = '#ffffff'
    labelTextColor: Optional[str] = None
    textAlign: Optional[str] = 'center'
    fontSize: Optional[float] = 12.0
    edgeSnapPoints: Optional[int] = 3
    style: NodeStyle = Field(default_factory=NodeStyle)

    class Config:
        extra = 'allow'

class ExportBounds(BaseModel):
    xMin: float = -10.0
    yMin: float = -10.0
    xMax: float = 10.0
    yMax: float = 10.0

class PlotOptions(BaseModel):
    showGrid: bool = True
    gridStyle: str = 'dotted'
    gridResolution: Optional[float] = 1.0
    showAxis: bool = True
    showAxisLabels: bool = True
    xLabel: Optional[str] = "$x$ [m]"
    yLabel: Optional[str] = "$y$ [m]"
    title: Optional[str] = None
    fontSize: Optional[float] = 12.0
    backgroundColor: str = "#ffffff"
    bgOpacity: Optional[float] = 1.0
    labelBoxOpacity: Optional[float] = 0.0
    scaleLabelsWithZoom: Optional[bool] = True
    marginPadding: Optional[float] = 0.05
    showPlotBorder: Optional[bool] = True
    grabHandleRadius: Optional[int] = 14
    cropToContent: Optional[bool] = False
    cropPadding: Optional[float] = 0.05
    renderMathOnCanvas: Optional[bool] = True
    activeWorkspaceTab: Optional[str] = 'main_scene'
    showLeftSidebar: Optional[bool] = True
    showRightPanel: Optional[bool] = True

    class Config:
        extra = 'allow'

class ProjectLayout(BaseModel):
    macros: Dict[str, MacroDefinition] = {}
    definitions: Dict[str, RobotDefinition] = {}
    scene: List[SceneNode] = []
    exportBounds: ExportBounds = Field(default_factory=ExportBounds)
    plotOptions: PlotOptions = Field(default_factory=PlotOptions)
