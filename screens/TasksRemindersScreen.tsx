import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, FlatList,
  Animated, Easing, PanResponder, StatusBar, AccessibilityInfo,
  TextInput, Modal, Image, Linking, KeyboardAvoidingView, ActionSheetIOS,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, copyAsync, makeDirectoryAsync } from 'expo-file-system/legacy';
import {
  CaretLeft, CaretRight, CircleIcon, CheckCircle, Clock, Trash,
  TextT, Link as LinkIcon, Plus, X as XIcon,
  FilePdf, FileDoc, FileImage, File as FileIcon,
} from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllCaptures, deleteCapture, setCompleted, updateAttachments, type Capture, type AttachmentFile } from '../utils/database';
import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from './HomeScreen';

type TasksRemindersNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TasksReminders'>;
interface Props { navigation: TasksRemindersNavigationProp; }

const COMPLETED_COLLAPSE_THRESHOLD = 5;
const DELETE_REVEAL_WIDTH = 80;
const ATTACHMENTS_DIR = (documentDirectory ?? '') + 'attachments/';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fileTypeIcon(name: string, color: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <FilePdf size={16} color={color} weight="regular" />;
  if (ext === 'doc' || ext === 'docx') return <FileDoc size={16} color={color} weight="regular" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'heic', 'webp'].includes(ext)) return <FileImage size={16} color={color} weight="regular" />;
  return <FileIcon size={16} color={color} weight="regular" />;
}

function hostnameFromURL(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

interface LightboxProps {
  photos: string[];
  initialIndex: number;
  visible: boolean;
  reduceMotion: boolean;
  onClose: () => void;
}

function PhotoLightbox({ photos, initialIndex, visible, reduceMotion, onClose }: LightboxProps) {
  const listRef = useRef<FlatList<string>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const dismissY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dismissY.setValue(0);
      setCurrentIndex(initialIndex);
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex, dismissY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) dismissY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50) {
          if (reduceMotion) { onClose(); return; }
          Animated.timing(dismissY, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose);
        } else {
          Animated.timing(dismissY, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Animated.View style={[styles.lightboxRoot, { transform: [{ translateY: dismissY }] }]} {...panResponder.panHandlers}>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!reduceMotion}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: styles.lightboxRoot.width ?? 400, offset: (styles.lightboxRoot.width ?? 400) * index, index })}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
            setCurrentIndex(idx);
          }}
          renderItem={({ item }) => (
            <View style={styles.lightboxPage}>
              <Image source={{ uri: item }} style={styles.lightboxImage} resizeMode="contain" />
            </View>
          )}
        />

        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={styles.lightboxArrowLeft}
                onPress={() => {
                  const next = currentIndex - 1;
                  listRef.current?.scrollToIndex({ index: next, animated: !reduceMotion });
                  setCurrentIndex(next);
                }}
              >
                <CaretLeft size={24} color="rgba(255,255,255,0.7)" weight="regular" />
              </TouchableOpacity>
            )}
            {currentIndex < photos.length - 1 && (
              <TouchableOpacity
                style={styles.lightboxArrowRight}
                onPress={() => {
                  const next = currentIndex + 1;
                  listRef.current?.scrollToIndex({ index: next, animated: !reduceMotion });
                  setCurrentIndex(next);
                }}
              >
                <CaretRight size={24} color="rgba(255,255,255,0.7)" weight="regular" />
              </TouchableOpacity>
            )}
            <View style={styles.lightboxDots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.lightboxDot, { opacity: i === currentIndex ? 1 : 0.35 }]} />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.lightboxClose} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <XIcon size={24} color="#fff" weight="regular" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

interface AttachmentAreaProps {
  captureId: string;
  initialNote: string | null;
  initialLink: string | null;
  initialPhotos: string[];
  initialFiles: AttachmentFile[];
  accent: string;
  textPrimary: string;
  reduceMotion: boolean;
}

function AttachmentArea({ captureId, initialNote, initialLink, initialPhotos, initialFiles, accent, textPrimary, reduceMotion }: AttachmentAreaProps) {
  const [noteText, setNoteText] = useState(initialNote ?? '');
  const [editingNote, setEditingNote] = useState(false);
  const [linkText, setLinkText] = useState(initialLink ?? '');
  const [editingLink, setEditingLink] = useState(false);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [files, setFiles] = useState<AttachmentFile[]>(initialFiles);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const noteRef = useRef(noteText);
  const linkRef = useRef(linkText);
  const photosRef = useRef(photos);
  const filesRef = useRef(files);

  useEffect(() => { noteRef.current = noteText; }, [noteText]);
  useEffect(() => { linkRef.current = linkText; }, [linkText]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { filesRef.current = files; }, [files]);

  const persist = useCallback((
    note: string, link: string, ph: string[], fi: AttachmentFile[]
  ) => {
    updateAttachments(
      captureId,
      note.trim() || null,
      link.trim() || null,
      ph,
      fi,
    ).catch(() => {});
  }, [captureId]);

  const saveNote = useCallback(() => {
    setEditingNote(false);
    persist(noteRef.current, linkRef.current, photosRef.current, filesRef.current);
  }, [persist]);

  const saveLink = useCallback(() => {
    setEditingLink(false);
    const trimmed = linkRef.current.trim();
    setLinkText(trimmed);
    persist(noteRef.current, trimmed, photosRef.current, filesRef.current);
  }, [persist]);

  const removeNote = useCallback(() => {
    setNoteText('');
    setEditingNote(false);
    persist('', linkRef.current, photosRef.current, filesRef.current);
  }, [persist]);

  const removeLink = useCallback(() => {
    setLinkText('');
    setEditingLink(false);
    persist(noteRef.current, '', photosRef.current, filesRef.current);
  }, [persist]);

  const ensureDir = useCallback(async () => {
    await makeDirectoryAsync(ATTACHMENTS_DIR, { intermediates: true }).catch(() => {});
  }, []);

  const openPhotoPicker = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const remaining = 5 - photosRef.current.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    await ensureDir();
    const newPaths: string[] = [];
    for (const asset of result.assets) {
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const dest = ATTACHMENTS_DIR + filename;
      await copyAsync({ from: asset.uri, to: dest });
      newPaths.push(dest);
    }
    const updated = [...photosRef.current, ...newPaths];
    setPhotos(updated);
    persist(noteRef.current, linkRef.current, updated, filesRef.current);
  }, [ensureDir, persist]);

  const openDocumentPicker = useCallback(async () => {
    if (filesRef.current.length >= 3) return;
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    await ensureDir();
    const dest = ATTACHMENTS_DIR + asset.name;
    await copyAsync({ from: asset.uri, to: dest });
    const updated = [...filesRef.current, { name: asset.name, path: dest }];
    setFiles(updated);
    persist(noteRef.current, linkRef.current, photosRef.current, updated);
  }, [ensureDir, persist]);

  const showAttachmentSheet = useCallback(() => {
    const photoAtLimit = photosRef.current.length >= 5;
    const fileAtLimit = filesRef.current.length >= 3;
    const options = [
      photoAtLimit ? `Photos (5 of 5 added)` : 'Photos',
      fileAtLimit ? `Files (3 of 3 added)` : 'Files',
      'Cancel',
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Add Attachment',
        options,
        cancelButtonIndex: 2,
        disabledButtonIndices: [
          ...(photoAtLimit ? [0] : []),
          ...(fileAtLimit ? [1] : []),
        ],
      },
      (buttonIndex) => {
        if (buttonIndex === 0 && !photoAtLimit) openPhotoPicker();
        if (buttonIndex === 1 && !fileAtLimit) openDocumentPicker();
      }
    );
  }, [openPhotoPicker, openDocumentPicker]);

  const removePhoto = useCallback((index: number) => {
    const updated = photosRef.current.filter((_, i) => i !== index);
    setPhotos(updated);
    persist(noteRef.current, linkRef.current, updated, filesRef.current);
  }, [persist]);

  const removeFile = useCallback((index: number) => {
    const updated = filesRef.current.filter((_, i) => i !== index);
    setFiles(updated);
    persist(noteRef.current, linkRef.current, photosRef.current, updated);
  }, [persist]);

  const hasNote = noteText.trim().length > 0;
  const hasLink = linkText.trim().length > 0;
  const hasPhotos = photos.length > 0;
  const hasFiles = files.length > 0;
  const hasAnyAttachment = hasPhotos || hasFiles;

  const chipFill = 'rgba(255,255,255,0.08)';
  const inputFill = 'rgba(255,255,255,0.06)';
  const fileFill = 'rgba(255,255,255,0.10)';
  const iconColor = `${textPrimary}73`;
  const contentColor = `${textPrimary}BF`;
  const removeColor = `${textPrimary}66`;
  const placeholderColor = `${textPrimary}4D`;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.attachDivider} />
      <View style={styles.attachArea}>

        {editingNote ? (
          <TextInput
            style={[styles.attachInput, { backgroundColor: inputFill, color: `${textPrimary}E6` }]}
            value={noteText}
            onChangeText={setNoteText}
            onBlur={saveNote}
            placeholder="Add a note…"
            placeholderTextColor={placeholderColor}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            returnKeyType="default"
            autoFocus
          />
        ) : hasNote ? (
          <View style={styles.attachRow}>
            <TextT size={16} color={iconColor} weight="regular" />
            <TouchableOpacity style={styles.attachRowContent} onPress={() => setEditingNote(true)}>
              <Text style={[styles.attachRowText, { color: contentColor }]} numberOfLines={1}>
                {noteText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={removeNote} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.attachRemoveHit}>
              <XIcon size={16} color={removeColor} weight="regular" />
            </TouchableOpacity>
          </View>
        ) : null}

        {editingLink ? (
          <View style={styles.attachRow}>
            <LinkIcon size={16} color={iconColor} weight="regular" />
            <TextInput
              style={[styles.attachInputInline, { backgroundColor: inputFill, color: `${textPrimary}E6` }]}
              value={linkText}
              onChangeText={setLinkText}
              onBlur={saveLink}
              placeholder="Paste or type a URL…"
              placeholderTextColor={placeholderColor}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveLink}
              autoFocus
            />
          </View>
        ) : hasLink ? (
          <View style={styles.attachRow}>
            <LinkIcon size={16} color={iconColor} weight="regular" />
            <TouchableOpacity style={styles.attachRowContent} onPress={() => setEditingLink(true)}>
              <Text style={[styles.attachRowText, { color: contentColor }]} numberOfLines={1}>
                {hostnameFromURL(linkText)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={removeLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.attachRemoveHit}>
              <XIcon size={16} color={removeColor} weight="regular" />
            </TouchableOpacity>
          </View>
        ) : null}

        {hasAnyAttachment && (
          <View style={styles.photoRow}>
            {photos.map((uri, i) => (
              <View key={uri} style={styles.photoThumbWrap}>
                <TouchableOpacity onPress={() => { setLightboxIndex(i); setLightboxVisible(true); }} activeOpacity={0.85}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBadge}
                  onPress={() => removePhoto(i)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <XIcon size={10} color="#000" weight="bold" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.photoAddBtn} onPress={openPhotoPicker}>
                <Plus size={20} color="rgba(255,255,255,0.40)" weight="regular" />
              </TouchableOpacity>
            )}
            <Text style={[styles.countLabel, { color: `${textPrimary}59` }]}>
              {photos.length} / 5
            </Text>
          </View>
        )}

        {hasAnyAttachment && (
          <View style={styles.fileChipRow}>
            {files.map((f, i) => (
              <View key={f.path} style={[styles.fileChip, { backgroundColor: fileFill }]}>
                <TouchableOpacity
                  style={styles.fileChipInner}
                  onPress={() => Linking.openURL(f.path).catch(() => {})}
                  activeOpacity={0.7}
                >
                  {fileTypeIcon(f.name, `${textPrimary}8C`)}
                  <Text style={[styles.fileChipName, { color: `${textPrimary}CC` }]} numberOfLines={1}>
                    {f.name.length > 19 ? f.name.slice(0, 16) + '…' + (f.name.split('.').pop() ? '.' + f.name.split('.').pop() : '') : f.name}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeFile(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <XIcon size={14} color={removeColor} weight="regular" />
                </TouchableOpacity>
              </View>
            ))}
            {files.length < 3 && (
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: chipFill }]} onPress={openDocumentPicker}>
                <Text style={[styles.actionChipLabel, { color: `${textPrimary}B3` }]}>+ File</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.countLabel, { color: `${textPrimary}59` }]}>
              {files.length} / 3
            </Text>
          </View>
        )}

        {(!hasNote || !hasLink || !hasAnyAttachment) && (
          <View style={styles.actionChipRow}>
            {!hasNote && (
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: chipFill }]} onPress={() => setEditingNote(true)}>
                <Text style={[styles.actionChipLabel, { color: `${textPrimary}B3` }]}>+ Note</Text>
              </TouchableOpacity>
            )}
            {!hasLink && (
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: chipFill }]} onPress={() => setEditingLink(true)}>
                <Text style={[styles.actionChipLabel, { color: `${textPrimary}B3` }]}>+ Link</Text>
              </TouchableOpacity>
            )}
            {!hasAnyAttachment && (
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: chipFill }]} onPress={showAttachmentSheet}>
                <Text style={[styles.actionChipLabel, { color: `${textPrimary}B3` }]}>+ Attachment</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex}
        visible={lightboxVisible}
        reduceMotion={reduceMotion}
        onClose={() => setLightboxVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

interface CardProps {
  item: Capture;
  type: 'task' | 'reminder';
  accent: string;
  textPrimary: string;
  textMuted: string;
  reduceMotionRef: React.MutableRefObject<boolean>;
  reduceMotion: boolean;
  onComplete: () => void;
  onDelete: () => void;
}

function SwipeableItemCard({ item, type, accent, textPrimary, textMuted, reduceMotionRef, reduceMotion, onComplete, onDelete }: CardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipedRef = useRef(false);
  const confirmingRef = useRef(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const snapBack = useCallback(() => {
    const dur = reduceMotionRef.current ? 0 : 150;
    Animated.timing(translateX, { toValue: 0, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start();
    swipedRef.current = false;
    confirmingRef.current = false;
    setConfirmingDelete(false);
  }, [translateX, reduceMotionRef]);

  const handleDeleteReveal = useCallback(() => {
    const dur = reduceMotionRef.current ? 0 : 150;
    Animated.timing(translateX, { toValue: 0, duration: dur, useNativeDriver: true }).start();
    swipedRef.current = false;
    confirmingRef.current = true;
    setConfirmingDelete(true);
  }, [translateX, reduceMotionRef]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !confirmingRef.current &&
        Math.abs(gs.dx) > Math.abs(gs.dy) &&
        Math.abs(gs.dx) > 8,
      onPanResponderMove: (_, gs) => {
        const base = swipedRef.current ? -DELETE_REVEAL_WIDTH : 0;
        translateX.setValue(Math.max(-DELETE_REVEAL_WIDTH, Math.min(0, base + gs.dx)));
      },
      onPanResponderRelease: (_, gs) => {
        const base = swipedRef.current ? -DELETE_REVEAL_WIDTH : 0;
        const effective = base + gs.dx;
        const dur = reduceMotionRef.current ? 0 : 150;
        if (effective < -40) {
          Animated.timing(translateX, { toValue: -DELETE_REVEAL_WIDTH, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start();
          swipedRef.current = true;
        } else {
          Animated.timing(translateX, { toValue: 0, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start();
          swipedRef.current = false;
        }
      },
    })
  ).current;

  const activeTextColor = `${textPrimary}E6`;
  const completedTextColor = `${textPrimary}66`;
  const timestampColor = `${textPrimary}73`;
  const cardFill = expanded ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.07)';

  return (
    <View style={styles.cardOuter}>
      <TouchableOpacity style={styles.deleteAction} onPress={handleDeleteReveal} activeOpacity={0.8}>
        <Trash size={20} color="#fff" weight="regular" />
        <Text style={styles.deleteActionLabel}>Delete</Text>
      </TouchableOpacity>

      <Animated.View
        style={[styles.card, { backgroundColor: cardFill, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {confirmingDelete ? (
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmText, { color: activeTextColor }]}>
              {type === 'task' ? 'Delete this task?' : 'Delete this reminder?'}
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity onPress={snapBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.cancelLabel, { color: textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.deleteConfirmLabel}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.cardContent}>
              <TouchableOpacity
                onPress={!item.completed ? onComplete : undefined}
                disabled={item.completed}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {item.completed ? (
                  <CheckCircle size={20} color={accent} weight="fill" />
                ) : type === 'task' ? (
                  <CircleIcon size={20} color={textMuted} weight="regular" />
                ) : (
                  <Clock size={20} color={textMuted} weight="regular" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardTextCol}
                onPress={type === 'task' ? () => setExpanded(e => !e) : undefined}
                activeOpacity={type === 'task' ? 0.7 : 1}
              >
                <Text
                  style={[styles.cardText, { color: item.completed ? completedTextColor : activeTextColor }]}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
                <Text style={[styles.timestamp, { color: timestampColor }]}>
                  {formatTimestamp(item.completed && item.completedAt ? item.completedAt : item.createdAt)}
                </Text>
              </TouchableOpacity>
            </View>

            {type === 'task' && expanded && (
              <AttachmentArea
                captureId={item.id}
                initialNote={item.attachmentNote}
                initialLink={item.attachmentLink}
                initialPhotos={item.attachmentPhotos}
                initialFiles={item.attachmentFiles}
                accent={accent}
                textPrimary={textPrimary}
                reduceMotion={reduceMotion}
              />
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

export default function TasksRemindersScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const [captures, setCaptures] = useState<Capture[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'reminders'>('tasks');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [toastCapture, setToastCapture] = useState<Capture | null>(null);
  const [tasksBtnLayout, setTasksBtnLayout] = useState({ x: 0, width: 0 });
  const [remindersBtnLayout, setRemindersBtnLayout] = useState({ x: 0, width: 0 });

  const reduceMotionRef = useRef(false);
  const activeTabRef = useRef<'tasks' | 'reminders'>('tasks');
  const scrollRef = useRef<ScrollView>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const underlineLeft = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => { reduceMotionRef.current = reduceMotion; }, [reduceMotion]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  const load = useCallback(() => {
    getAllCaptures().then(setCaptures).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const target = activeTab === 'tasks' ? tasksBtnLayout : remindersBtnLayout;
    if (target.width === 0) return;
    const dur = reduceMotion ? 0 : 150;
    Animated.parallel([
      Animated.timing(underlineLeft, { toValue: target.x, duration: dur, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(underlineWidth, { toValue: target.width, duration: dur, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
    ]).start();
  }, [activeTab, tasksBtnLayout, remindersBtnLayout, reduceMotion, underlineLeft, underlineWidth]);

  const switchTab = useCallback((tab: 'tasks' | 'reminders') => {
    if (tab === activeTabRef.current) return;
    const dur = reduceMotionRef.current ? 0 : 150;
    Animated.timing(contentOpacity, { toValue: 0, duration: dur, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      setShowAllCompleted(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(contentOpacity, { toValue: 1, duration: dur, useNativeDriver: true }).start();
    });
  }, [contentOpacity]);

  const handleComplete = useCallback(async (item: Capture) => {
    await setCompleted(item.id, true, Date.now());
    load();
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastCapture(item);
    toastTimeoutRef.current = setTimeout(() => {
      setToastCapture(null);
      toastTimeoutRef.current = null;
    }, 4000);
  }, [load]);

  const handleUndo = useCallback(async () => {
    if (!toastCapture) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = null;
    await setCompleted(toastCapture.id, false, null);
    setToastCapture(null);
    load();
  }, [toastCapture, load]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCapture(id);
    load();
  }, [load]);

  const tag = activeTab === 'tasks' ? 'task' : 'reminder';
  const filtered = captures.filter(cap => cap.tag === tag);
  const active = filtered.filter(cap => !cap.completed).sort((a, b) => b.createdAt - a.createdAt);
  const completed = filtered.filter(cap => cap.completed).sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_COLLAPSE_THRESHOLD);
  const hiddenCount = completed.length - COMPLETED_COLLAPSE_THRESHOLD;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <CaretLeft size={20} color={c.textPrimary} weight="regular" />
          <Text style={[styles.backLabel, { color: c.textPrimary }]}>
            {activeTab === 'tasks' ? 'Tasks' : 'Reminders'}
          </Text>
        </TouchableOpacity>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onLayout={e => setTasksBtnLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            onPress={() => switchTab('tasks')}
            style={styles.toggleBtn}
          >
            <Text style={[styles.toggleLabel, { color: activeTab === 'tasks' ? c.textPrimary : `${c.textPrimary}73` }]}>
              Tasks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onLayout={e => setRemindersBtnLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            onPress={() => switchTab('reminders')}
            style={styles.toggleBtn}
          >
            <Text style={[styles.toggleLabel, { color: activeTab === 'reminders' ? c.textPrimary : `${c.textPrimary}73` }]}>
              Reminders
            </Text>
          </TouchableOpacity>
          <Animated.View
            style={[styles.toggleUnderline, { backgroundColor: c.accent, left: underlineLeft, width: underlineWidth }]}
          />
        </View>

        <View style={styles.topBarSpacer} />
      </View>

      <Animated.View style={[styles.flex1, { opacity: contentOpacity }]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {active.length === 0 ? (
            <Text style={[styles.emptyText, { color: `${c.textPrimary}73` }]}>
              {activeTab === 'tasks' ? 'No tasks yet.' : 'No reminders yet.'}
            </Text>
          ) : (
            active.map(item => (
              <SwipeableItemCard
                key={item.id}
                item={item}
                type={tag}
                accent={c.accent}
                textPrimary={c.textPrimary}
                textMuted={c.textMuted}
                reduceMotionRef={reduceMotionRef}
                reduceMotion={reduceMotion}
                onComplete={() => handleComplete(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))
          )}

          {completed.length > 0 && (
            <>
              <View style={styles.completedHeader}>
                <View style={[styles.completedHairline, { backgroundColor: '#FFFFFF1A' }]} />
                <Text style={[styles.completedLabel, { color: `${c.textPrimary}66` }]}>Completed</Text>
                <View style={[styles.completedHairline, { backgroundColor: '#FFFFFF1A' }]} />
              </View>

              {visibleCompleted.map(item => (
                <SwipeableItemCard
                  key={item.id}
                  item={item}
                  type={tag}
                  accent={c.accent}
                  textPrimary={c.textPrimary}
                  textMuted={c.textMuted}
                  reduceMotionRef={reduceMotionRef}
                  reduceMotion={reduceMotion}
                  onComplete={() => {}}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}

              {!showAllCompleted && hiddenCount > 0 && (
                <TouchableOpacity onPress={() => setShowAllCompleted(true)} style={styles.showAllBtn}>
                  <Text style={[styles.showAllLabel, { color: c.accent }]}>
                    Show all ({completed.length})
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {toastCapture !== null && (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>
            {toastCapture.tag === 'task' ? 'Task completed.' : 'Reminder completed.'}
          </Text>
          <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.toastUndo, { color: c.accent }]}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  backLabel: {
    fontSize: 17,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 4,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
  },
  toggleUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  topBarSpacer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    marginTop: 16,
    gap: 8,
  },
  completedHairline: {
    flex: 1,
    height: 1,
  },
  completedLabel: {
    fontSize: 13,
  },
  showAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  showAllLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardOuter: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_REVEAL_WIDTH,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteActionLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTextCol: {
    flex: 1,
    gap: 4,
  },
  cardText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 13,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmText: {
    fontSize: 14,
    flex: 1,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelLabel: {
    fontSize: 14,
  },
  deleteConfirmLabel: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30,30,30,0.94)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toastText: {
    color: '#FDF8F2',
    fontSize: 14,
    flex: 1,
  },
  toastUndo: {
    fontSize: 14,
    fontWeight: '500',
  },

  attachDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    marginHorizontal: -16,
  },
  attachArea: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachRowContent: {
    flex: 1,
  },
  attachRowText: {
    fontSize: 15,
  },
  attachRemoveHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachInput: {
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  attachInputInline: {
    flex: 1,
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    height: 40,
  },
  actionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionChipLabel: {
    fontSize: 14,
  },

  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  photoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddBtn: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: {
    fontSize: 13,
  },

  fileChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
    gap: 6,
  },
  fileChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  fileChipName: {
    fontSize: 13,
    maxWidth: 120,
  },

  lightboxRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.90)',
    width: '100%' as any,
  },
  lightboxPage: {
    width: '100%' as any,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%' as any,
    height: '80%' as any,
  },
  lightboxClose: {
    position: 'absolute',
    top: 56,
    right: 20,
  },
  lightboxArrowLeft: {
    position: 'absolute',
    left: 16,
    top: '50%' as any,
    marginTop: -12,
  },
  lightboxArrowRight: {
    position: 'absolute',
    right: 16,
    top: '50%' as any,
    marginTop: -12,
  },
  lightboxDots: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  lightboxDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
});
