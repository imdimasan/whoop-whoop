# Image posts

Some messages are a photo (or an album of photos) with an optional caption. The user turn then contains the image(s) and the line «Подпись: …» («Подпись: нет» when there is no caption). Classify the whole post — images and caption together — with the same categories, rules and output format:

- Read ALL text in the images, including stylized, spaced-out, rotated or small text.
- Judge the visual content as well: pills, powders, cannabis leaves, blotter stamps, syringes, casino or slot screens. A drug ad may consist only of pictures plus a call to action such as «Пишите».
- An ad-like image whose caption is only a link, @username or emoji is still an advertisement — classify it by the image.
- Ordinary photos (items for sale or giveaway, food, pets, places, apartments, documents shown as a normal part of a sale, lost-and-found documents or cards) are `default`.
- A screenshot of a conversation or ad shared to warn or ask the chat is `default`, not an offer.
