{
  "patcher": {
    "fileversion": 1,
    "appversion": {
      "major": 9,
      "minor": 1,
      "revision": 4,
      "architecture": "x64",
      "modernui": 1
    },
    "classnamespace": "box",
    "rect": [100.0, 100.0, 760.0, 520.0],
    "openrect": [0.0, 0.0, 483.0, 169.0],
    "openinpresentation": 1,
    "bglocked": 0,
    "default_fontsize": 10.0,
    "default_fontface": 0,
    "default_fontname": "Arial",
    "gridonopen": 1,
    "gridsize": [8.0, 8.0],
    "toolbarvisible": 1,
    "boxanimatetime": 200,
    "enablehscroll": 1,
    "enablevscroll": 1,
    "devicewidth": 483.0,
    "description": "ICE AGE v1.1.0 - Ableton Live 12 freeze assistant by Aynix.x",
    "digest": "",
    "tags": "freeze utility Ableton Live 12 Aynix.x",
    "boxes": [
      {
        "box": {
          "id": "button-stop",
          "maxclass": "textbutton",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [430.0, 188.0, 50.33333483338356, 33.6548333501322],
          "presentation": 1,
          "presentation_rect": [414.0, 39.0, 50.33333483338356, 33.6548333501322],
          "mode": 0,
          "outputmode": 1,
          "text": "",
          "texton": "",
          "rounded": 0.0,
          "bgcolor": [0.0, 0.0, 0.0, 0.0],
          "bgoncolor": [0.0, 0.0, 0.0, 0.0],
          "usebgoncolor": 1,
          "color": [0.0, 0.0, 0.0, 0.0],
          "textcolor": [0.0, 0.0, 0.0, 0.0],
          "textoncolor": [0.0, 0.0, 0.0, 0.0],
          "parameter_enable": 0,
          "annotation": "STOP - cancel the remaining queue."
        }
      },
      {
        "box": {
          "id": "button-audio",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [20.0, 188.0, 124.0, 22.0],
          "presentation": 1,
          "presentation_rect": [19.0, 74.0, 124.0, 22.0],
          "text": "FREEZE AUDIO",
          "fontface": 1,
          "fontsize": 12.0,
          "textjustification": 1,
          "bgcolor": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgcolor2": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgfillcolor_angle": 269.5558555668881,
          "bgfillcolor_autogradient": 0.0,
          "bgfillcolor_color": [0.043137254901961, 0.070588235294118, 0.149019607843137, 0.03],
          "bgfillcolor_color1": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgfillcolor_color2": [0.290196078431373, 0.309803921568627, 0.301960784313725, 1.0],
          "bgfillcolor_proportion": 0.39,
          "bgfillcolor_pt1": [0.494949494949495, 0.015151515151515],
          "bgfillcolor_pt2": [0.484848484848485, 1.318181818181818],
          "bgfillcolor_type": "color",
          "gradient": 1,
          "textcolor": [1.0, 1.0, 1.0, 1.0],
          "annotation": "Freeze every eligible audio track."
        }
      },
      {
        "box": {
          "id": "button-midi",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [154.0, 188.0, 123.0, 22.0],
          "presentation": 1,
          "presentation_rect": [125.0, 74.0, 123.0, 22.0],
          "text": "FREEZE MIDI",
          "fontface": 1,
          "fontsize": 12.0,
          "textjustification": 1,
          "bgcolor": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgcolor2": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgfillcolor_angle": 269.5558555668881,
          "bgfillcolor_autogradient": 0.0,
          "bgfillcolor_color": [0.043137254901961, 0.070588235294118, 0.149019607843137, 0.03],
          "bgfillcolor_color1": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgfillcolor_color2": [0.290196078431373, 0.309803921568627, 0.301960784313725, 1.0],
          "bgfillcolor_proportion": 0.39,
          "bgfillcolor_pt1": [0.494949494949495, 0.015151515151515],
          "bgfillcolor_pt2": [0.484848484848485, 1.318181818181818],
          "bgfillcolor_type": "color",
          "gradient": 1,
          "textcolor": [1.0, 1.0, 1.0, 1.0],
          "annotation": "Freeze every eligible MIDI track."
        }
      },
      {
        "box": {
          "id": "button-all",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [288.0, 188.0, 121.0, 22.0],
          "presentation": 1,
          "presentation_rect": [232.0, 74.0, 121.0, 22.0],
          "text": "ICE AGE",
          "fontface": 1,
          "fontsize": 12.0,
          "textjustification": 1,
          "bgcolor": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgcolor2": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgfillcolor_angle": 269.5558555668881,
          "bgfillcolor_autogradient": 0.0,
          "bgfillcolor_color": [0.043137254901961, 0.070588235294118, 0.149019607843137, 0.03],
          "bgfillcolor_color1": [0.2, 0.258823529411765, 0.368627450980392, 1.0],
          "bgfillcolor_color2": [0.290196078431373, 0.309803921568627, 0.301960784313725, 1.0],
          "bgfillcolor_proportion": 0.39,
          "bgfillcolor_pt1": [0.494949494949495, 0.015151515151515],
          "bgfillcolor_pt2": [0.484848484848485, 1.318181818181818],
          "bgfillcolor_type": "color",
          "gradient": 1,
          "textcolor": [1.0, 1.0, 1.0, 1.0],
          "annotation": "Freeze every eligible audio and MIDI track."
        }
      },
      {
        "box": {
          "id": "version",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [430.0, 134.0, 74.0, 21.0],
          "presentation": 1,
          "presentation_rect": [364.0, 45.0, 74.0, 21.0],
          "text": "V.1.1.0",
          "fontname": "Arial",
          "fontsize": 12.0,
          "fontface": 1,
          "textcolor": [0.94, 0.97, 0.98, 1.0],
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "subtitle",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [204.0, 156.0, 212.0, 21.0],
          "presentation": 1,
          "presentation_rect": [114.0, 44.0, 212.0, 21.0],
          "text": "ABLETON LIVE 12 FREEZE ASSISTANT  ·  BY AYNIX.X",
          "fontname": "Arial",
          "fontsize": 8.0,
          "fontface": 1,
          "textcolor": [0.631372549019608, 0.815686274509804, 0.945098039215686, 1.0],
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "title",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [204.0, 124.0, 105.0, 28.0],
          "presentation": 1,
          "presentation_rect": [114.0, 21.0, 105.0, 28.0],
          "text": "ICE AGE",
          "fontname": "Arial",
          "fontsize": 18.0,
          "fontface": 1,
          "textcolor": [0.94, 0.97, 0.98, 1.0],
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "logo-flat",
          "maxclass": "fpic",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["jit_matrix"],
          "patching_rect": [430.0, 84.0, 50.33333483338356, 33.6548333501322],
          "presentation": 1,
          "presentation_rect": [414.0, 39.0, 50.33333483338356, 33.6548333501322],
          "pic": "assets/icon_face_flat.png",
          "embed": 1,
          "autofit": 1,
          "forceaspect": 1,
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "logo-open",
          "maxclass": "fpic",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["jit_matrix"],
          "patching_rect": [108.0, 116.0, 85.66666921973228, 57.28008060254289],
          "presentation": 1,
          "presentation_rect": [37.0, 15.0, 85.66666921973228, 57.28008060254289],
          "pic": "assets/icon_face_open.png",
          "embed": 1,
          "autofit": 1,
          "forceaspect": 1,
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "button-shape-audio",
          "maxclass": "fpic",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["jit_matrix"],
          "patching_rect": [20.0, 232.0, 187.66667225956917, 187.66667225956917],
          "presentation": 1,
          "presentation_rect": [-1.0, -86.0, 187.66667225956917, 187.66667225956917],
          "pic": "assets/button_shape_reference.png",
          "embed": 1,
          "autofit": 1,
          "forceaspect": 1,
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "button-shape-midi",
          "maxclass": "fpic",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["jit_matrix"],
          "patching_rect": [218.0, 232.0, 187.66667225956917, 187.66667225956917],
          "presentation": 1,
          "presentation_rect": [105.0, -86.0, 187.66667225956917, 187.66667225956917],
          "pic": "assets/button_shape_reference.png",
          "embed": 1,
          "autofit": 1,
          "forceaspect": 1,
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "button-shape-all",
          "maxclass": "fpic",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["jit_matrix"],
          "patching_rect": [416.0, 232.0, 187.66667225956917, 187.66667225956917],
          "presentation": 1,
          "presentation_rect": [211.0, -86.0, 187.66667225956917, 187.66667225956917],
          "pic": "assets/button_shape_reference.png",
          "embed": 1,
          "autofit": 1,
          "forceaspect": 1,
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "background-image",
          "maxclass": "fpic",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["jit_matrix"],
          "patching_rect": [20.0, 440.0, 483.0, 483.0],
          "presentation": 1,
          "presentation_rect": [0.0, -312.0, 483.0, 483.0],
          "pic": "assets/ice_age_background_full.png",
          "embed": 1,
          "autofit": 1,
          "xoffset": -2.0,
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "status",
          "maxclass": "comment",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [36.0, 470.0, 360.0, 18.0],
          "presentation": 0,
          "text": "Starting ICE AGE...",
          "fontname": "Arial",
          "fontsize": 10.0,
          "fontface": 1,
          "textcolor": [0.94, 0.97, 1.0, 1.0],
          "ignoreclick": 1
        }
      },
      {
        "box": {
          "id": "command-audio",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [36.0, 220.0, 90.0, 22.0],
          "text": "freeze_audio"
        }
      },
      {
        "box": {
          "id": "command-midi",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [136.0, 220.0, 88.0, 22.0],
          "text": "freeze_midi"
        }
      },
      {
        "box": {
          "id": "command-all",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [234.0, 220.0, 60.0, 22.0],
          "text": "ice_age"
        }
      },
      {
        "box": {
          "id": "command-stop",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [304.0, 220.0, 50.0, 22.0],
          "text": "stop"
        }
      },
      {
        "box": {
          "id": "core",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 3,
          "outlettype": ["", "", ""],
          "patching_rect": [36.0, 278.0, 190.0, 22.0],
          "text": "js ice_age_core110.js"
        }
      },
      {
        "box": {
          "id": "helper",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 2,
          "outlettype": ["", ""],
          "patching_rect": [270.0, 278.0, 328.0, 22.0],
          "text": "node.script ice_age_helper110.js @autostart 1 @restart 1"
        }
      },
      {
        "box": {
          "id": "print-core",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [36.0, 326.0, 148.0, 22.0],
          "text": "print ice-age-core"
        }
      },
      {
        "box": {
          "id": "print-helper",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [270.0, 326.0, 154.0, 22.0],
          "text": "print ice-age-helper"
        }
      },
      {
        "box": {
          "id": "loadbang",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": ["bang"],
          "patching_rect": [36.0, 390.0, 60.0, 22.0],
          "text": "loadbang"
        }
      },
      {
        "box": {
          "id": "deferlow",
          "maxclass": "newobj",
          "numinlets": 1,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [106.0, 390.0, 58.0, 22.0],
          "text": "deferlow"
        }
      },
      {
        "box": {
          "id": "default-setup",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [174.0, 390.0, 100.0, 22.0],
          "text": "default_setup"
        }
      },
      {
        "box": {
          "id": "debug-scan",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [36.0, 444.0, 42.0, 22.0],
          "text": "scan"
        }
      },
      {
        "box": {
          "id": "debug-reset",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [88.0, 444.0, 44.0, 22.0],
          "text": "reset"
        }
      },
      {
        "box": {
          "id": "debug-timeout",
          "maxclass": "message",
          "numinlets": 2,
          "numoutlets": 1,
          "outlettype": [""],
          "patching_rect": [142.0, 444.0, 112.0, 22.0],
          "text": "timeout 900000"
        }
      }
    ],
    "lines": [
      {
        "patchline": {
          "source": ["button-audio", 0],
          "destination": ["command-audio", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["button-midi", 0],
          "destination": ["command-midi", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["button-all", 0],
          "destination": ["command-all", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["button-stop", 0],
          "destination": ["command-stop", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["command-audio", 0],
          "destination": ["core", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["command-midi", 0],
          "destination": ["core", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["command-all", 0],
          "destination": ["core", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["command-stop", 0],
          "destination": ["core", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["core", 0],
          "destination": ["helper", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["core", 1],
          "destination": ["print-core", 0]
        }
      },
      {
        "patchline": {
          "source": ["core", 2],
          "destination": ["status", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["helper", 0],
          "destination": ["core", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["helper", 1],
          "destination": ["print-helper", 0]
        }
      },
      {
        "patchline": {
          "source": ["loadbang", 0],
          "destination": ["deferlow", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["deferlow", 0],
          "destination": ["default-setup", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["default-setup", 0],
          "destination": ["core", 0],
          "hidden": 1
        }
      },
      {
        "patchline": {
          "source": ["debug-scan", 0],
          "destination": ["core", 0]
        }
      },
      {
        "patchline": {
          "source": ["debug-reset", 0],
          "destination": ["core", 0]
        }
      },
      {
        "patchline": {
          "source": ["debug-timeout", 0],
          "destination": ["core", 0]
        }
      }
    ],
    "autosave": 0
  }
}
