import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, Card, H1, P, Screen } from '../components/ui';
import type { Song } from '../data/types';
import { useGame } from '../state/GameContext';
import { colors } from '../theme';

const THIS_YEAR = new Date().getFullYear();

/** Songlisten ansehen, einzelne Songs ein- und ausblenden und eigene Songs hinzufügen. */
export default function SongsScreen() {
  const params = useLocalSearchParams<{ cat?: string }>();
  const { allCategories, hiddenIds, setSongsHidden, addSong, removeSong } = useGame();
  const [catId, setCatId] = useState(params.cat ?? allCategories[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const category = allCategories.find((c) => c.id === catId) ?? allCategories[0];
  const songs = category?.songs ?? [];
  const activeCount = songs.filter((s) => !hiddenIds.has(s.id)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? songs.filter((s) => `${s.title} ${s.artist} ${s.year}`.toLowerCase().includes(q)) : songs;
    return [...list].sort((a, b) => a.year - b.year || a.artist.localeCompare(b.artist));
  }, [songs, query]);

  const yearNum = parseInt(year, 10);
  const validYear = yearNum >= 1900 && yearNum <= THIS_YEAR;
  const canAdd = !!title.trim() && !!artist.trim() && validYear;

  const submit = () => {
    if (!category || !canAdd) return;
    addSong(category.id, { title, artist, year: yearNum });
    setMsg(`„${title.trim()}“ hinzugefügt.`);
    setTitle('');
    setArtist('');
    setYear('');
  };

  const header = (
    <View style={{ gap: 16 }}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <H1>Songlisten</H1>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {allCategories.map((c) => {
          const selected = c.id === category?.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                setCatId(c.id);
                setQuery('');
                setMsg(null);
              }}
            >
              <LinearGradient
                colors={selected ? c.colors : [colors.card, colors.card]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.chip, !selected && { borderColor: colors.cardBorder, borderWidth: 1 }]}
              >
                <Text style={styles.chipText}>
                  {c.emoji} {c.name}
                </Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {activeCount} von {songs.length} Songs aktiv
        </Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable
            onPress={() =>
              setSongsHidden(
                songs.map((s) => s.id),
                false,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.link}>Alle an</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setSongsHidden(
                songs.map((s) => s.id),
                true,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.link}>Alle aus</Text>
          </Pressable>
        </View>
      </View>

      {adding ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.formTitle}>Song zu {category?.name} hinzufügen</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titel"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={80}
          />
          <TextInput
            value={artist}
            onChangeText={setArtist}
            placeholder="Künstler"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={80}
          />
          <TextInput
            value={year}
            onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="Jahr, z. B. 2019"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
          {year.length === 4 && !validYear && (
            <P style={{ color: colors.yellow }}>Das Jahr muss zwischen 1900 und {THIS_YEAR} liegen.</P>
          )}
          <P style={{ fontSize: 13 }}>
            Mit Spotify wird der Song über Titel und Künstler gesucht, also am besten genau so schreiben wie dort.
          </P>
          <Button title="Hinzufügen" onPress={submit} disabled={!canAdd} />
          <Button
            title="Fertig"
            variant="ghost"
            onPress={() => {
              setAdding(false);
              setMsg(null);
            }}
          />
        </Card>
      ) : (
        <Button
          title="Song hinzufügen"
          variant="ghost"
          onPress={() => setAdding(true)}
          icon={<Ionicons name="add-circle" size={20} color={colors.textDim} />}
        />
      )}
      {msg && <P style={{ color: colors.green }}>{msg}</P>}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Suchen nach Titel, Künstler oder Jahr"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
      />
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 12 }}
        ListEmptyComponent={<P style={{ textAlign: 'center' }}>Keine Songs gefunden.</P>}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        windowSize={7}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <SongRow
            song={item}
            active={!hiddenIds.has(item.id)}
            own={item.id.includes(':eigen:')}
            onToggle={(on) => setSongsHidden([item.id], !on)}
            onRemove={() => category && removeSong(category.id, item.id)}
          />
        )}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={{ height: 6 }} />;
}

function SongRow({
  song,
  active,
  own,
  onToggle,
  onRemove,
}: {
  song: Song;
  active: boolean;
  own: boolean;
  onToggle: (on: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.row, !active && { opacity: 0.45 }]}>
      <Text style={styles.year}>{song.year}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
          {own ? ' · eigener Song' : ''}
        </Text>
      </View>
      {own && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`${song.title} löschen`}>
          <Ionicons name="trash" size={20} color={colors.textMuted} />
        </Pressable>
      )}
      <Switch
        value={active}
        onValueChange={onToggle}
        trackColor={{ false: colors.cardBorder, true: colors.pink }}
        thumbColor="#fff"
        accessibilityLabel={`${song.title} ${active ? 'ausblenden' : 'einblenden'}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  chipText: { color: colors.text, fontWeight: '800' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { color: colors.text, fontWeight: '800', fontSize: 16 },
  link: { color: colors.cyan, fontWeight: '800' },
  formTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  input: {
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  year: { color: colors.yellow, fontWeight: '900', fontSize: 15, width: 42 },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  artist: { color: colors.textDim, fontSize: 13, marginTop: 2 },
});
