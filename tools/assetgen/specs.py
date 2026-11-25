"""ComfyUI で作る素材の一覧（プロンプト・シード・採用した番号）。"""

STUDIO = (
    "{}. Studio product photo, a single object centred, the whole object visible, plain white background, "
    "soft even light, no harsh shadow, realistic, high detail"
)
HAND = (
    "cleanly cut at the wrist, completely hairless smooth skin with no arm hair, natural light tan skin, anatomically correct, "
    "exactly five fingers, "
    "plain white background, soft even studio light, no shadow, high detail photo"
)
APOSE = (
    "shown from the hips up, standing in an A-pose with both straight arms held away from the body at 45 degrees, "
    "clear empty gap between the arms and the torso, {}, front view, symmetrical, facing the camera, mouth closed, "
    "plain white background, soft even studio light, no shadow, realistic, high detail, 3D character reference"
)

# 3D にする小物・人物：写真を作り、pick 番目のシードの写真を TRELLIS.2 に渡す
MODELS = {
    # ライターは動く部品（ホイール・レバー）があるので、部品ごとに作って組み立てる
    "lighter_body": {
        "prompt": STUDIO.format(
            "The plastic fuel tank of a disposable lighter without any metal parts, a smooth glossy red plastic block with "
            "rounded corners and an oval cross-section, flat top with a thin black plastic collar, standing upright, "
            "three-quarter view, no logo, no text"
        ),
        "size": (1024, 1024), "seeds": [101, 102, 103, 104], "pick": 3,
    },
    "lighter_hood": {
        "prompt": STUDIO.format(
            "A small polished chrome sheet-metal wind guard part of a cigarette lighter, a bent U-shaped metal shield open at "
            "the top, bottom and back, with a row of small round holes punched in the front, isolated spare part, "
            "three-quarter view"
        ),
        "size": (1024, 1024), "seeds": [105, 106, 107, 108], "pick": 3,
    },
    "lighter_wheel": {
        "prompt": STUDIO.format(
            "A single small serrated steel lighter spark wheel, a short thick cylinder roller with sharp diagonal knurled teeth "
            "all around its rim and a plain round hub on each side, isolated spare part, macro photo, three-quarter view"
        ),
        "size": (1024, 1024), "seeds": [109, 110, 115, 116], "pick": 3,
    },
    "lighter_lever": {
        "prompt": STUDIO.format(
            "A single small matte black plastic push button of a cigarette lighter, a rounded rectangular thumb pad with fine "
            "ridges on top, isolated spare part, macro photo, three-quarter view from above"
        ),
        "size": (1024, 1024), "seeds": [117, 118, 119, 120], "pick": 1,
    },
    "hand_back": {
        "prompt": "A realistic adult right hand of a man seen from the back, fingers straight up, all five fingers clearly "
        "separated and slightly spread, the thumb pointing out to the left side, short clean fingernails, " + HAND,
        "size": (1024, 1024), "seeds": [241, 242, 243, 244], "pick": 2,
    },
    # hand_back の写真から腕の毛だけ消したもの（参照画像つきの編集）。これを 3D にする
    "hand": {
        "prompt": "Keep exactly the same hand, pose, fingers, nails and lighting. Remove every hair from the forearm and wrist so "
        "that the arm is perfectly smooth, clean shaven, hairless skin with a clean sharp outline against the plain white "
        "background.",
        "reference": "hand_back_243", "steps": 6,
        "size": (1024, 1024), "seeds": [1, 2, 3], "pick": 1,
    },
    "ojisan": {
        "prompt": "Photo of a scruffy friendly Japanese man in his sixties " + APOSE.format(
            "wearing a mustard yellow knit beanie, grey hair at the temples, a grey mustache and stubble, "
            "a worn brown corduroy jacket with a brown scarf"
        ),
        "size": (1024, 1024), "seeds": [135, 136, 137, 138], "pick": 1,
    },
    "salaryman": {
        "prompt": "Photo of a tired polite Japanese office worker man in his forties " + APOSE.format(
            "black side-parted hair, thin rectangular glasses, a navy business suit, white shirt and burgundy tie"
        ),
        "size": (1024, 1024), "seeds": [145, 146, 147, 148], "pick": 1,
    },
    "phone": {
        "prompt": STUDIO.format(
            "A modern generic black smartphone lying flat, screen up, switched off black glossy screen, thin metal frame, "
            "seen from a three-quarter angle above, no logo, no text"
        ),
        "size": (1024, 1024), "seeds": [151, 152, 153, 154], "pick": 1,
    },
    "ashtray": {
        "prompt": STUDIO.format(
            "A round scratched stainless steel ashtray with grey ash and three crushed cigarette butts with cork-coloured "
            "filters in it, seen from a three-quarter angle above, no text"
        ),
        "size": (1024, 1024), "seeds": [161, 162, 163, 164], "pick": 0,
    },
    "moth": {
        "prompt": STUDIO.format(
            "A brown moth with its wings spread fully open and flat, symmetrical, furry body, feathery antennae, "
            "seen from directly above, museum specimen without pin"
        ),
        "size": (1024, 1024), "seeds": [171, 172, 173, 174], "pick": 0,
    },
    "matchbox": {
        "prompt": STUDIO.format(
            "A small retro Japanese cardboard safety match box lying on its side like a brick, much wider than tall, closed, the "
            "wide front face is a cream label with a thin red border and one single simple symmetrical orange and red flame icon "
            "in the centre, no letters, the long narrow top face is a rough dark brown striking surface, eye-level view slightly "
            "from above"
        ),
        "size": (1024, 1024), "seeds": [271, 272, 273, 274], "pick": 1,
    },
    "match_box": {
        "prompt": STUDIO.format(
            "One single unused wooden matchstick with a rounded dark red match head, lying diagonally, "
            "thick square wooden stick, macro photo"
        ),
        "size": (1024, 1024), "seeds": [201, 202, 203, 204], "pick": 1,
    },
    "match_paper": {
        "prompt": STUDIO.format(
            "One single unused flat cardboard paper match torn from a matchbook, cream white flat paper stick with a small "
            "dark blue match head, lying diagonally, macro photo"
        ),
        "size": (1024, 1024), "seeds": [211, 212, 213, 214], "pick": 0,
    },
    "cigarette": {
        "prompt": "One single new unlit filter cigarette, perfectly straight, plain white paper tube and an orange cork-patterned "
        "filter at one end, brown shredded tobacco visible at the open other end, lying diagonally, isolated on a plain dark "
        "slate grey background, soft even light, no shadow, no ring, no text, macro product photo, realistic, high detail",
        "size": (1024, 1024), "seeds": [261, 262, 263, 264], "pick": 3,
    },
    "sleeve": {
        "prompt": STUDIO.format(
            "A forearm in a dark navy blue padded jacket sleeve with a ribbed knit cuff at the wrist, arm raised straight up "
            "vertically, no hand, the sleeve is a single straight fabric tube with natural folds, isolated on white"
        ),
        "size": (1024, 1024), "seeds": [235, 236, 237, 238], "pick": 3,
    },
}

# 2D のまま使う背景・質感・UI
IMAGES = {
    "city": {
        "prompt": "Night view from a high apartment balcony over a dense Tokyo-like residential city, many apartment buildings "
        "and distant office towers with warm lit windows, a purple-blue dusk sky with a faint glow at the horizon and thin "
        "clouds, no railing, no balcony, no people, no text, straight horizon at lower middle, cinematic photo, realistic, "
        "high detail",
        "size": (2048, 1024), "seeds": [301, 302, 303, 304],
    },
    # 場所ごとの背景（煙草を吸えそうな場所）。手前の台に物を置くので、下の方は奥の地面にする
    "place_konbini": {
        "prompt": "Night view from the smoking corner outside a small fictional Japanese convenience store, looking across the "
        "parking lot, bright store windows on the right side, a few parked cars, vending machines glowing, wet asphalt with "
        "reflections, suburban street and utility poles, no people, no text, no logos, no signs with letters, eye-level view, "
        "cinematic photo, realistic, high detail",
        "size": (2048, 1024), "seeds": [401, 402, 403, 404],
    },
    "place_rooftop": {
        "prompt": "Night view from the rooftop of an old office building, water tanks, air conditioning units and pipes on the "
        "left and right, high-rise towers with red aviation lights all around, dark stormy blue sky with fast moving clouds, "
        "no railing, no people, no text, eye-level view, cinematic photo, realistic, high detail",
        "size": (2048, 1024), "seeds": [411, 412, 413, 414],
    },
    "place_kissaten": {
        "prompt": "Interior of a cosy retro Japanese coffee shop seen from a table seat, dark wood panels, warm stained glass "
        "lamps, red velvet chairs, a wooden counter with coffee siphons and cups in the background, warm dim light, no people, "
        "no text, eye-level view, cinematic photo, realistic, high detail",
        "size": (2048, 1024), "seeds": [421, 422, 423, 424],
    },
    "place_camp": {
        "prompt": "Night campsite by a quiet lake seen from a camping chair, a small campfire glowing a few metres away, a tent lit "
        "softly from inside, dark pine trees, calm water reflecting a clear starry sky, no people, no text, eye-level view, "
        "cinematic photo, realistic, high detail",
        "size": (2048, 1024), "seeds": [431, 432, 433, 434],
    },
    "place_harbor": {
        "prompt": "Early dawn at a small Japanese fishing harbour seen from the breakwater, calm sea, moored fishing boats, a distant "
        "lighthouse, pale orange and blue sky, light mist, no people, no text, horizon in the middle, cinematic photo, realistic, "
        "high detail",
        "size": (2048, 1024), "seeds": [441, 442, 443, 444],
    },
    "place_engawa": {
        "prompt": "View from the wooden veranda of an old Japanese inn onto a small garden at night in light snow, stone lantern with "
        "warm light, pine trees and bamboo covered with a little snow, steam rising from a hot spring pond, dark blue night, no "
        "people, no text, eye-level view, cinematic photo, realistic, high detail",
        "size": (2048, 1024), "seeds": [451, 452, 453, 454],
    },
    # タイトル画面の絵
    "keyvisual": {
        "prompt": "Cinematic close-up photo at night, two hands cupping a small lighter flame against the wind, warm orange light on "
        "the fingers, blurred blue city lights far behind, large dark empty space on the left half, shallow depth of field, no "
        "face, no text, no logo, moody, realistic, high detail",
        "size": (1920, 1088), "seeds": [461, 462, 463, 464],
    },
    # 手前の台の質感
    "wood_dark": {
        "prompt": "Seamless tileable texture of a dark polished walnut coffee table top, fine straight grain, a few faint scratches, "
        "flat even lighting, seen from directly above, no objects, no shadows",
        "size": (1024, 1024), "seeds": [471, 472],
    },
    "wood_plank": {
        "prompt": "Seamless tileable texture of weathered wooden planks of an outdoor table, horizontal boards with thin gaps, warm "
        "grey brown, flat even lighting, seen from directly above, no objects, no shadows",
        "size": (1024, 1024), "seeds": [475, 476],
    },
    "steel": {
        "prompt": "Seamless tileable texture of a scratched brushed stainless steel counter plate, fine horizontal brushing, small "
        "stains, flat even lighting, seen from directly above, no objects, no reflections",
        "size": (1024, 1024), "seeds": [479, 480],
    },
    "bokeh": {
        "prompt": "Completely out of focus night city lights background, soft round bokeh circles in warm orange, amber and "
        "white, with a few blue and violet lights on a dark navy background, photo, no text",
        "size": (1536, 1024), "seeds": [311, 312, 313],
    },
    "concrete": {
        "prompt": "Seamless tileable texture of a weathered grey concrete balcony ledge, flat even lighting, seen from directly "
        "above, fine pores, subtle stains and hairline cracks, no shadows, no objects",
        "size": (1024, 1024), "seeds": [321, 322, 323],
    },
    "wall": {
        "prompt": "Seamless tileable texture of a Japanese apartment exterior wall with small rectangular beige-grey ceramic "
        "tiles and thin mortar lines, flat even lighting, seen straight on, slightly weathered, no shadows",
        "size": (1024, 1024), "seeds": [331, 332, 333],
    },
    "matchbook": {
        "prompt": "Flat top-down scan of a vintage paper matchbook cover, landscape rectangle filling the whole image edge to "
        "edge, dark navy blue cardboard with a thin gold border line and a small gold crescent moon emblem in the centre, "
        "slightly worn paper, no letters, flat even light, no shadow, no background",
        "size": (1344, 768), "seeds": [281, 282, 283],
    },
    "striker": {
        "prompt": "Seamless tileable macro texture of a match box striking surface, rough reddish dark brown phosphorus coating "
        "with a fine dotted grain and a few light scratch marks, flat even light, no objects",
        "size": (1024, 1024), "seeds": [285, 286, 287],
    },
    "wallpaper": {
        "prompt": "Minimal abstract smartphone wallpaper, night sky gradient from deep indigo to dusky pink over a silhouette "
        "of low hills, a thin crescent moon, calm, no text, no icons",
        "size": (768, 1536), "seeds": [341, 342, 343],
    },
}

# 着信画面の顔写真（架空の人物）
AVATARS = {
    "boss": "A stern fictional Japanese company manager in his fifties in a grey suit, office background",
    "mother": "A gentle fictional Japanese mother in her sixties in a home kitchen",
    "landlord": "A cheerful fictional elderly Japanese landlord man with a straw hat in front of a small apartment building",
}
AVATAR_STYLE = "{}. Casual smartphone contact photo, head and shoulders, centred, soft light, realistic, no text"
