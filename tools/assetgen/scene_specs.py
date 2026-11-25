"""背景の 3D 小物の一覧（場所ごとの建物・木・家具など）。gen.py から使う。

height = ゲーム内での高さ（m）。yaw = 正面（+Z）へ向けるための回転（度）。tex = 仕上げのテクスチャの大きさ。
"""

OBJECT = (
    "{}. A single isolated object, the whole object visible and centred, three-quarter view from slightly above, plain white "
    "background, soft even light, no shadow, no people, no text, no letters, no logo, realistic, high detail, 3D asset reference photo"
)


def item(text, height, seeds, faces=5000, tex=512, pick=0, yaw=0):
    return {"prompt": OBJECT.format(text), "size": (1024, 1024), "seeds": seeds, "pick": pick, "faces": faces, "tex": tex, "height": height, "yaw": yaw}


SCENE = {
    # 街の建物（夜。明かりのついた窓は、明るい所だけゲーム側で光らせる）
    "mixed": item("A narrow five-storey Japanese mixed-use city building with an external staircase and air conditioners, at night with a few lit windows", 16, [505, 506], 4000, 1024),
    "house": item("A two-storey Japanese suburban house with a dark grey tiled roof and white walls, at dusk with warm lit windows", 7.5, [507, 508], 4000, 1024),
    # コンビニ前
    "vending": item("A red Japanese drink vending machine with rows of generic coloured bottles and cans behind a lit glass panel, seen from the front", 1.85, [513, 514], 3000, 512),
    "car": item("A small white boxy Japanese kei car, parked, clean, side three-quarter view", 1.65, [515, 516], 7000, 1024, pick=1),
    "bins": item("A row of three grey Japanese recycling bins with round holes", 1.0, [517, 518], 3000, 512),
    # 屋上
    "tank": item("A large cylindrical grey rooftop water tank standing on rusty steel legs with a ladder and pipes", 4.2, [521, 522], 6000, 1024),
    "ac": item("A single weathered outdoor air conditioner condenser unit with a round fan grille", 0.9, [523, 524], 3000, 512),
    "duct": item("A bent galvanised steel rooftop ventilation duct with a hood", 1.6, [525, 526], 3000, 512, pick=1),
    # 純喫茶
    "chair": item("A retro red velvet armchair with dark wooden legs from an old coffee shop", 0.95, [531, 532], 6000, 1024),
    "lamp": item("A stained glass dome pendant lamp shade with warm amber and green glass", 0.36, [533, 534], 5000, 1024),
    "siphon": item("A glass coffee siphon brewer with a wooden handle on a small stand, half full of dark coffee", 0.4, [535, 536], 5000, 512, pick=1),
    "cup": item("A white porcelain coffee cup full of black coffee on a saucer with a small spoon", 0.09, [537, 538], 4000, 512),
    "grinder": item("A vintage red cast iron coffee grinder machine with a hopper", 0.55, [539, 540], 5000, 512, pick=1),
    "cabinet": item("A dark wooden cafe shelf cabinet filled with white cups, jars and bottles, front view", 2.0, [541, 542], 8000, 1024, pick=1),
    # キャンプ場
    "tent": item("A beige canvas dome camping tent with an open entrance, softly lit from inside", 1.7, [551, 552], 6000, 1024),
    "logs": item("A small campfire of burning logs arranged in a cone inside a ring of grey stones, no flames, glowing embers", 0.45, [553, 554], 5000, 1024),
    "conifer": item("A single tall dark green fir tree with dense branches", 9, [555, 556], 6000, 1024),
    "campchair": item("A folding canvas camping chair in olive green", 0.85, [557, 558], 5000, 512, pick=1),
    "lantern": item("A small vintage metal camping lantern with a glass chimney", 0.35, [559, 560], 4000, 512),
    # 港
    "boat": item("A small white and blue Japanese fishing boat with a wheelhouse and mast", 4.2, [561, 562], 8000, 1024),
    "lighthouse": item("A small white harbour lighthouse on a round concrete base", 9, [563, 564], 4000, 512),
    "tetrapod": item("A single weathered concrete tetrapod wave breaker block", 2.4, [565, 566], 2000, 512, pick=1),
    "bollard": item("A rusty black iron mooring bollard with a thick rope around it", 0.6, [567, 568], 4000, 512),
    # 縁側
    "toro": item("A traditional Japanese stone garden lantern with a warm light inside and a little snow on top", 1.7, [571, 572], 6000, 1024, pick=1),
    "pine": item("A sculpted Japanese garden pine tree with layered branches covered with snow", 3.6, [573, 574], 8000, 1024),
    "rock": item("A large mossy garden rock with snow on top", 0.9, [575, 576], 2500, 512),
    "bamboo": item("A dense clump of tall green bamboo stalks with leaves and a little snow", 5.5, [577, 578], 8000, 1024),
    # ---- 吸う場所の手前に置く物と、にぎやかしの小物
    # ベランダ
    "stool": item("A small round wooden stool with three legs", 0.45, [701, 702], 2500, 512),
    "potplant": item("A lush green leafy potted plant in a terracotta pot", 0.75, [703, 704], 5000, 512),
    "flowers": item("A rectangular balcony planter box full of red and pink geranium flowers", 0.4, [705, 706], 5000, 512),
    "laundry": item("A white shirt, a blue shirt and two towels hanging on a horizontal metal laundry pole, front view", 0.95, [707, 708], 5000, 512),
    "sandals": item("A pair of brown plastic sandals on the ground", 0.1, [709, 710], 2500, 512),
    # コンビニ前
    "bicycle": item("A silver Japanese city bicycle with a front basket on its kickstand, side view", 1.05, [713, 714], 9000, 1024),
    "scooter": item("A small black delivery motor scooter parked on its stand, three-quarter view", 1.1, [715, 716], 7000, 512),
    "cone": item("An orange traffic cone with white reflective stripes", 0.7, [717, 718], 1500, 256),
    "rack": item("A wire magazine rack filled with colourful blank magazines, front view", 1.3, [719, 720], 5000, 512),
    "icebox": item("A white outdoor ice cream freezer chest with a sliding glass top", 0.9, [721, 722], 3000, 512),
    "bush": item("A round trimmed green hedge bush", 0.9, [723, 724], 4000, 512),
    "tree": item("A single leafy broadleaf street tree with a thin trunk", 6, [725, 726], 8000, 1024),
    # 屋上
    "crates": item("A stack of two yellow plastic beer crates", 0.62, [731, 732], 3000, 512),
    "redcan": item("A dented red metal bucket used as an outdoor ashtray, half full of sand and cigarette butts", 0.4, [733, 734], 4000, 512),
    "bench": item("An old weathered wooden park bench with a rusty metal frame", 0.85, [735, 736], 4000, 512),
    "dish": item("A grey rooftop satellite dish antenna on a mast", 1.8, [737, 738], 3000, 512),
    "pipechair": item("A folding steel pipe chair with a grey vinyl seat", 0.8, [739, 740], 4000, 512),
    "fan": item("A large square rooftop industrial exhaust fan unit with louvers", 1.5, [741, 742], 4000, 512),
    # 純喫茶
    "sofa": item("A two-seat red velvet booth sofa from a retro coffee shop, front view", 1.05, [751, 752], 6000, 1024),
    "cafetable": item("A square dark wooden cafe table with a single iron pedestal leg", 0.68, [753, 754], 3000, 512),
    "sugar": item("A glass sugar pot with a chrome lid and a small spoon", 0.14, [755, 756], 3000, 256),
    "menu": item("A small wooden menu stand holding a blank cream card", 0.2, [757, 758], 2000, 256),
    "water": item("A clear glass tumbler of iced water", 0.13, [759, 760], 2500, 256),
    "clock": item("An antique dark wooden wall pendulum clock, front view", 0.8, [761, 762], 4000, 512),
    "palm": item("A potted indoor palm plant in a brass pot", 1.5, [763, 764], 6000, 512),
    "register": item("A vintage ornate brass cash register", 0.5, [765, 766], 5000, 512),
    "showcase": item("A glass cake display case with several slices of cake, pudding and cream soda inside, front view", 1.2, [767, 768], 6000, 1024),
    "jars": item("A row of four glass jars full of roasted coffee beans with wooden lids", 0.25, [769, 770], 4000, 512),
    "record": item("A vintage wooden gramophone record player with a large brass horn", 0.75, [771, 772], 6000, 512),
    # キャンプ場
    "firewood": item("A neat stack of split firewood logs", 0.55, [781, 782], 5000, 512),
    "cooler": item("A blue and white camping cooler box", 0.42, [783, 784], 2500, 512),
    "kettle": item("A blue enamel camping kettle with black soot", 0.24, [785, 786], 3000, 256),
    "mug": item("A white enamel camping mug with black coffee", 0.1, [787, 788], 2500, 256),
    "logseat": item("A single thick sawn tree log lying on the ground as a bench", 0.42, [789, 790], 3000, 512),
    "camptable": item("A low folding wooden camping table with slatted top", 0.36, [791, 792], 3000, 512),
    "stump": item("A tree stump with an axe stuck in it", 0.75, [793, 794], 4000, 512),
    "backpack": item("A large green hiking backpack standing upright", 0.65, [795, 796], 4000, 512),
    "fern": item("A single green fern plant with many fronds", 0.6, [797, 798], 5000, 512),
    "canoe": item("A red wooden canoe upside down on the ground", 0.6, [799, 800], 4000, 512),
    "tripod": item("A black cast iron pot hanging by a chain from a wooden campfire tripod", 1.35, [801, 802], 4000, 512),
    # 港
    "tackle": item("A red and grey fishing tackle box, closed", 0.3, [811, 812], 3000, 512),
    "bluebucket": item("A light blue plastic bucket with water and small fish", 0.3, [813, 814], 3000, 512),
    "rope": item("A thick coiled mooring rope on the ground", 0.28, [815, 816], 4000, 512),
    "nets": item("A large pile of green fishing nets with orange floats", 0.8, [817, 818], 6000, 512),
    "buoy": item("An orange round plastic fishing buoy with a rope ring", 0.5, [819, 820], 2000, 256),
    "fishcrates": item("A stack of blue plastic fish crates and white styrofoam boxes", 0.95, [821, 822], 4000, 512),
    "gull": item("A single white and grey seagull standing", 0.4, [823, 824], 4000, 256),
    "truck": item("A small white Japanese kei pickup truck, three-quarter view", 1.75, [825, 826], 7000, 1024),
    "shed": item("A small old wooden fishing shed with a rusty corrugated iron roof", 3.4, [827, 828], 5000, 1024),
    # 縁側
    "teaset": item("A black lacquer tray with a Japanese teapot and two tea cups", 0.16, [831, 832], 5000, 512),
    "zabuton": item("A square purple Japanese zabuton floor cushion", 0.09, [833, 834], 2000, 512),
    "andon": item("A square wooden and paper Japanese andon floor lantern, lit warm", 0.62, [835, 836], 3000, 512),
    "hibachi": item("A round blue and white ceramic Japanese hibachi brazier with glowing charcoal and ash", 0.36, [837, 838], 4000, 512),
    "geta": item("A pair of wooden Japanese geta sandals with red straps", 0.09, [839, 840], 2500, 256),
    "shishi": item("A Japanese bamboo shishi-odoshi water fountain with a stone basin and a little snow", 0.85, [841, 842], 5000, 512),
    "snowbush": item("A round garden shrub covered with fresh snow", 0.8, [843, 844], 3500, 512),
    "stones": item("Three flat Japanese garden stepping stones with snow on the edges", 0.14, [845, 846], 2500, 512),
    "bridge": item("A small arched red wooden Japanese garden bridge with snow on it", 1.1, [847, 848], 5000, 512),
    "pail": item("A wooden Japanese bath bucket with a folded white towel", 0.24, [849, 850], 3000, 256),
    # ライターの本体（フードとレバーは bl_props.py で形を作る）
    "lighter2_body": item("The fuel tank body of a disposable lighter without any metal parts, glossy deep blue plastic, tall with an oval cross-section, flat top, a thin white plastic rim at the bottom, completely plain", 1, [581, 582, 583], 5000, 1024, pick=1),
}

# 背景の質感
SCENE_IMAGES = {
    "asphalt": {"prompt": "Seamless tileable texture of a wet dark asphalt parking lot, fine grain, a few patches and cracks, flat even lighting, seen from directly above, no lines, no objects", "size": (1024, 1024), "seeds": [601, 602]},
    "forest": {"prompt": "Seamless tileable texture of a forest campsite ground, dark soil, pine needles, small stones and sparse grass, flat even lighting, seen from directly above, no objects", "size": (1024, 1024), "seeds": [603, 604]},
    "plaster": {"prompt": "Seamless tileable texture of an old cream plaster wall in a coffee shop, slightly stained by smoke, flat even lighting, seen straight on, no objects", "size": (1024, 1024), "seeds": [605, 606]},
    "snow": {"prompt": "Seamless tileable texture of fresh undisturbed snow on the ground, subtle soft bumps, flat even lighting, seen from directly above, no objects", "size": (1024, 1024), "seeds": [607, 608]},
    "facade": {"prompt": "Seamless tileable texture of a Japanese apartment building facade at night seen perfectly straight on, regular grid of windows and balconies, about a third of the windows lit warm yellow, the rest dark, flat orthographic view, no sky, no text", "size": (1024, 1024), "seeds": [609, 610, 611]},
    "facade2": {"prompt": "Seamless tileable texture of a modern office building glass curtain wall at night seen perfectly straight on, regular grid of windows, many lit in white, some dark, flat orthographic view, no sky, no text", "size": (1024, 1024), "seeds": [612, 613, 614]},
    "bark": {"prompt": "Seamless tileable texture of rough dark pine tree bark, deep vertical furrows, flat even lighting, seen straight on, no objects", "size": (1024, 1024), "seeds": [620, 621]},
    "panel": {"prompt": "Seamless tileable texture of a dark brown vertical wooden plank wall in an old Japanese coffee shop, glossy aged varnish, flat even lighting, seen straight on, no objects", "size": (1024, 1024), "seeds": [622, 623]},
    "stained": {"prompt": "A rectangular stained glass window with a simple retro geometric and flower pattern in amber, green, red and cream, backlit evenly, seen perfectly straight on, filling the whole image, no text", "size": (768, 1024), "seeds": [624, 625]},
    "goods": {"prompt": "Straight-on orthographic photo of Japanese convenience store shelves densely packed with rows of small colourful snack bags, boxes and bottles with plain blank labels, bright even lighting, filling the whole image, no readable text, no logos", "size": (1024, 1024), "seeds": [626, 627]},
    "fridge": {"prompt": "Straight-on orthographic photo of a convenience store drink refrigerator full of neatly arranged colourful plain bottles and cans on glass shelves, bright white light, filling the whole image, no readable text, no logos", "size": (1024, 1024), "seeds": [628, 629]},
    "roofdeck": {"prompt": "Seamless tileable texture of an old dark grey waterproofed concrete rooftop floor with stains, seams and faint puddle marks, flat even lighting, seen from directly above, no objects", "size": (1024, 1024), "seeds": [630, 631]},
    "quay": {"prompt": "Seamless tileable texture of an old weathered concrete harbor quay surface with small cracks, stains and gravel aggregate, flat even lighting, seen from directly above, no objects", "size": (1024, 1024), "seeds": [632, 633]},
    "brickwall": {"prompt": "Seamless tileable texture of a weathered dirty concrete parapet wall with rain streaks, flat even lighting, seen straight on, no objects", "size": (1024, 1024), "seeds": [634, 635]},
}
