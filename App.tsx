import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Sound from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import Svg, { Rect } from 'react-native-svg';

interface Recording {
  name: string;
  path: string;
}

// Waveform component for real-time recording visualization
const RecordingWaveform: React.FC<{ isRecording: boolean; isPaused: boolean }> = ({
  isRecording,
  isPaused
}) => {
  const [waveData, setWaveData] = useState<number[]>([]);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording && !isPaused) {
      // Simulate real-time waveform data
      animationRef.current = setInterval(() => {
        setWaveData(prev => {
          const newData = [...prev, Math.random() * 100 + 10];
          return newData.slice(-50); // Keep last 50 data points
        });
      }, 100);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    }

    if (!isRecording) {
      setWaveData([]);
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const screenWidth = Dimensions.get('window').width - 40;
  const barWidth = screenWidth / 50;

  return (
    <View style={styles.waveformContainer}>
      <Svg height="80" width={screenWidth}>
        {waveData.map((height, index) => (
          <Rect
            key={index}
            x={index * barWidth}
            y={40 - height / 2}
            width={barWidth - 1}
            height={height}
            fill={isPaused ? "#ff6b6b" : "#4ecdc4"}
          />
        ))}
      </Svg>
    </View>
  );
};

// Playback popup modal with waveform
const PlaybackModal: React.FC<{
  visible: boolean;
  recording: Recording | null;
  isPlaying: boolean;
  isPaused: boolean;
  onClose: () => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}> = ({ visible, recording, isPlaying, isPaused, onClose, onPlay, onPause, onResume, onStop }) => {
  const [playbackWaveData] = useState<number[]>(
    // Generate static waveform data for demonstration
    Array.from({ length: 100 }, () => Math.random() * 60 + 10)
  );
  const [currentPosition, setCurrentPosition] = useState(0);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying && !isPaused && visible) {
      animationRef.current = setInterval(() => {
        setCurrentPosition(prev => {
          const newPos = prev + 1;
          if (newPos >= playbackWaveData.length) {
            // Audio finished
            onStop();
            return 0;
          }
          return newPos;
        });
      }, 100);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, isPaused, visible, playbackWaveData.length, onStop]);

  useEffect(() => {
    if (!visible) {
      setCurrentPosition(0);
    }
  }, [visible]);

  const screenWidth = Dimensions.get('window').width - 80;
  const barWidth = screenWidth / 100;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{recording?.name || 'Playback'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.playbackWaveformContainer}>
            <Svg height="120" width={screenWidth}>
              {playbackWaveData.map((height, index) => (
                <Rect
                  key={index}
                  x={index * barWidth}
                  y={60 - height / 2}
                  width={barWidth - 1}
                  height={height}
                  fill={index <= currentPosition ? "#4ecdc4" : "#e0e0e0"}
                />
              ))}
            </Svg>
            {/* Progress indicator */}
            <View
              style={[
                styles.progressIndicator,
                { left: currentPosition * barWidth }
              ]}
            />
          </View>

          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                if (isPlaying) {
                  if (isPaused) {
                    onResume();
                  } else {
                    onPause();
                  }
                } else {
                  onPlay();
                }
              }}
            >
              <Text style={styles.controlButtonText}>
                {isPlaying && !isPaused ? '⏸️' : '▶️'}
              </Text>
            </TouchableOpacity>

            {isPlaying && (
              <TouchableOpacity
                style={styles.controlButton}
                onPress={onStop}
              >
                <Text style={styles.controlButtonText}>⏹️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  const audioPath = Platform.select({
    ios: `${RNFS.DocumentDirectoryPath}/recording-${Date.now()}.m4a`,
    android: `${RNFS.DocumentDirectoryPath}/recording-${Date.now()}.mp4`,
  });

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);

        if (
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] ===
          PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('Permissions granted');
        } else {
          Alert.alert('Permissions Required', 'Please grant microphone and storage permissions to use this app.');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  useEffect(() => {
    requestPermissions();
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const dirPath = RNFS.DocumentDirectoryPath;
      const result = await RNFS.readDir(dirPath);
      const audioFiles = result
        .filter(item => item.name.endsWith('.m4a') || item.name.endsWith('.mp4'))
        .sort((a, b) => b.mtime!.getTime() - a.mtime!.getTime());
      const formattedRecordings = audioFiles.map(file => ({
        name: file.name,
        path: file.path,
      }));
      setRecordings(formattedRecordings);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const startRecording = async () => {
    if (!audioPath) return;
    try {
      await Sound.startRecorder(audioPath);
      setIsRecording(true);
      setIsPaused(false);
    } catch (e) {
      console.error('startRecording failed', e);
    }
  };

  const pauseRecording = async () => {
    try {
      await Sound.pauseRecorder();
      setIsPaused(true);
    } catch (e) {
      console.error('pauseRecording failed', e);
    }
  };

  const resumeRecording = async () => {
    try {
      await Sound.resumeRecorder();
      setIsPaused(false);
    } catch (e) {
      console.error('resumeRecording failed', e);
    }
  };

  const stopRecording = async () => {
    try {
      await Sound.stopRecorder();
      setIsRecording(false);
      setIsPaused(false);
      await loadRecordings();
    } catch (e) {
      console.error('stopRecording failed', e);
    }
  };

  const startPlayback = async (path: string) => {
    try {
      await Sound.startPlayer(path);
      setIsPlaying(true);
      setIsPaused(false);
      Sound.addPlayBackListener(info => {
        if ((info as any).isFinished) { // Type assertion fix
          setIsPlaying(false);
          setIsPaused(false);
          setShowPlaybackModal(false);
        }
      });
    } catch (e) {
      console.error('startPlayback failed', e);
    }
  };

  const pausePlayback = async () => {
    try {
      await Sound.pausePlayer();
      setIsPaused(true);
    } catch (e) {
      console.error('pausePlayback failed', e);
    }
  };

  const resumePlayback = async () => {
    try {
      await Sound.resumePlayer();
      setIsPaused(false);
    } catch (e) {
      console.error('resumePlayback failed', e);
    }
  };

  const stopPlayback = async () => {
    try {
      await Sound.stopPlayer();
      setIsPlaying(false);
      setIsPaused(false);
      setShowPlaybackModal(false);
    } catch (e) {
      console.error('stopPlayback failed', e);
    }
  };

  const handlePlayRecording = (recording: Recording) => {
    setSelectedRecording(recording);
    setShowPlaybackModal(true);
    startPlayback(recording.path);
  };

  const handleCloseModal = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      setShowPlaybackModal(false);
      setSelectedRecording(null);
    }
  };

  const renderItem = ({ item }: { item: Recording }) => (
    <View style={styles.recordingItem}>
      <Text style={styles.recordingText}>{item.name}</Text>
      <View style={styles.playbackButtons}>
        <Button
          title="Play"
          onPress={() => handlePlayRecording(item)}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <Text style={styles.title}>Voice Recorder</Text>

      <View style={styles.buttonContainer}>
        {!isRecording && (
          <Button title="Start Recording" onPress={startRecording} />
        )}
        {isRecording && !isPaused && (
          <>
            <Button title="Pause Recording" onPress={pauseRecording} />
            <Button title="Stop Recording" onPress={stopRecording} color="red" />
          </>
        )}
        {isRecording && isPaused && (
          <>
            <Button title="Resume Recording" onPress={resumeRecording} />
            <Button title="Stop Recording" onPress={stopRecording} color="red" />
          </>
        )}
      </View>

      {/* Waveform visualization during recording */}
      {isRecording && (
        <View style={styles.recordingSection}>
          <Text style={styles.recordingStatusText}>
            {isPaused ? 'Recording Paused' : 'Recording...'}
          </Text>
          <RecordingWaveform isRecording={isRecording} isPaused={isPaused} />
        </View>
      )}

      <Text style={styles.listTitle}>Saved Recordings</Text>
      <FlatList
        data={recordings}
        renderItem={renderItem}
        keyExtractor={item => item.path}
        style={styles.list}
      />

      {/* Playback Modal */}
      <PlaybackModal
        visible={showPlaybackModal}
        recording={selectedRecording}
        isPlaying={isPlaying}
        isPaused={isPaused}
        onClose={handleCloseModal}
        onPlay={() => selectedRecording && startPlayback(selectedRecording.path)}
        onPause={pausePlayback}
        onResume={resumePlayback}
        onStop={stopPlayback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  recordingSection: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recordingStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  waveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 10,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  recordingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  recordingText: {
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  },
  playbackButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  playbackWaveformContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  progressIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ff6b6b',
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    backgroundColor: '#4ecdc4',
    borderRadius: 50,
    padding: 15,
    minWidth: 60,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 24,
  },
});

export default App;