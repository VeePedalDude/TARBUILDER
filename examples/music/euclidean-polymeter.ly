\version "2.24.0"
\header {
  title = "Euclidean polymeter"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = \drummode { \time 4/4 { <bd sn hh cb>8 cb16 <bd sn hh>16 r16 <sn hh cb>16 bd16 <hh cb>16 <bd sn>8 <sn hh cb>16 bd16 <sn hh cb>8 <bd hh>16 <sn cb>16 |
    <bd hh>16 <sn cb>16 r16 <bd hh>16 <sn cb>16 hh16 <bd sn cb>16 hh16 <bd sn>16 cb16 hh16 <bd sn cb>16 hh16 sn16 <bd hh cb>8 |
    <bd sn hh cb>8 sn16 <bd hh cb>16 sn16 <hh cb>16 bd16 <sn hh>16 <bd cb>16 sn16 <hh cb>16 bd16 <sn hh>16 cb16 <bd sn hh>16 cb16 |
    <bd sn hh>8 cb16 <bd sn hh>16 cb16 <sn hh>16 bd16 <hh cb>16 <bd sn>16 cb16 <sn hh>16 bd16 <sn hh cb>8 <bd hh cb>16 sn16 |
    <bd hh>16 <sn cb>16 r16 <bd hh cb>16 sn16 hh16 <bd sn cb>16 hh16 <bd sn cb>8 hh16 <bd sn cb>16 hh16 <sn cb>16 <bd hh>8 |
    <bd sn hh cb>8 <sn cb>16 <bd hh>16 sn16 <hh cb>16 bd16 <sn hh cb>16 bd16 sn16 <hh cb>16 bd16 <sn hh cb>8 <bd sn hh>16 cb16 |
    <bd sn hh>16 cb16 r16 <bd sn hh>16 cb16 <sn hh>16 <bd cb>16 hh16 <bd sn>16 cb16 <sn hh>16 <bd cb>16 <sn hh>8 <bd hh cb>16 sn16 |
    <bd hh cb>16 sn16 r16 <bd hh cb>16 sn16 <hh cb>16 <bd sn>16 hh16 <bd sn cb>8 <hh cb>16 <bd sn>16 hh16 <sn cb>16 <bd hh>16 cb16 | } }

\score {
  <<
    \new DrumStaff \with { instrumentName = "Drums" } \trackA
  >>
  \layout { }
  \midi { }
}