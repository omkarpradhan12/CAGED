from theory_snake.chord_builder import build_chord
from theory_snake import guitar_utils

chord = build_chord("E","minor")

tuning = guitar_utils.select_tuning("Standard")

# Build a full fretboard (each open string -> list of fretted notes)
fretboard = guitar_utils.build_fretboard(tuning)

guitar_chord_shape = guitar_utils.make_guitar_chord(fretboard, chord)

print(guitar_chord_shape)
