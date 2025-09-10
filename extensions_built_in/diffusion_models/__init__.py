from .chroma import ChromaModel
from .hidream import HidreamModel, HidreamE1Model
from .f_light import FLiteModel
from .omnigen2 import OmniGen2Model
from .flux_kontext import FluxKontextModel
from .wan22 import Wan225bModel, Wan2214bModel, Wan2214bI2VModel
try:
    from .qwen_image import QwenImageModel, QwenImageEditModel
    QWEN_IMAGE_AVAILABLE = True
except ImportError:
    QWEN_IMAGE_AVAILABLE = False
    QwenImageModel = None
    QwenImageEditModel = None

AI_TOOLKIT_MODELS = [
    # put a list of models here
    ChromaModel,
    HidreamModel,
    HidreamE1Model,
    FLiteModel,
    OmniGen2Model,
    FluxKontextModel,
    Wan225bModel,
    Wan2214bI2VModel,
    Wan2214bModel,
    QwenImageModel if QWEN_IMAGE_AVAILABLE else None,
    QwenImageEditModel if QWEN_IMAGE_AVAILABLE else None,
]
