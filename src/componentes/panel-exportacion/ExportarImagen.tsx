/**
 * @archivo ExportarImagen.tsx
 * @descripcion Panel de exportación de imagen del diagrama.
 * Permite seleccionar formato (PNG/SVG/WEBP), color de fondo,
 * escala y previsualizar con controles de zoom antes de descargar.
 * Incluye modal de previsualización a pantalla completa.
 */
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Text,
  Select,
  Button,
  Switch,
  Group,
  Stack,
  ColorInput,
  SegmentedControl,
  Center,
  Loader,
  Modal,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { VscDesktopDownload, VscFileMedia, VscZoomIn, VscZoomOut, VscScreenFull } from 'react-icons/vsc';
import { UsarTema } from '@/hooks/UsarTema';
import { ModeloDiagrama } from '@/transformadores/ast-a-diagrama';
import {
  exportar_imagen,
  generar_previsualizacion,
  descargar_blob,
  FormatoImagen,
  OpcionesExportarImagen,
} from '@/exportacion/exportar-imagen';

/** Nivel de zoom mínimo para la previsualización */
const ZOOM_MIN = 0.1;
/** Nivel de zoom máximo para la previsualización */
const ZOOM_MAX = 5;
/** Paso de zoom por click */
const PASO_ZOOM = 0.25;

/**
 * Propiedades del componente ExportarImagen.
 */
interface PropiedadesExportarImagen {
  /** Modelo del diagrama a exportar */
  modelo: ModeloDiagrama | null;
}

/**
 * Componente de previsualización con zoom y paneo.
 * Reutilizado tanto en el panel lateral como en el modal.
 */
function VistaPrevia({
  url_preview,
  tiene_contenido,
  generando_preview,
  fondo_transparente,
  color_fondo,
  al_abrir_modal,
  altura_minima,
  es_modal,
}: {
  url_preview: string | null;
  tiene_contenido: boolean;
  generando_preview: boolean;
  fondo_transparente: boolean;
  color_fondo: string;
  al_abrir_modal?: () => void;
  altura_minima: number;
  es_modal?: boolean;
}) {
  const [zoom, fijarZoom] = useState(1);
  const [arrastrando, fijarArrastrando] = useState(false);
  const [posicion, fijarPosicion] = useState({ x: 0, y: 0 });
  const ultimo_punto_ref = useRef({ x: 0, y: 0 });
  const contenedor_ref = useRef<HTMLDivElement>(null);

  // Resetear zoom y posición cuando cambia la imagen
  useEffect(() => {
    fijarZoom(1);
    fijarPosicion({ x: 0, y: 0 });
  }, [url_preview]);

  const acercar = useCallback(() => {
    fijarZoom((z) => Math.min(z + PASO_ZOOM, ZOOM_MAX));
  }, []);

  const alejar = useCallback(() => {
    fijarZoom((z) => Math.max(z - PASO_ZOOM, ZOOM_MIN));
  }, []);

  const resetear_zoom = useCallback(() => {
    fijarZoom(1);
    fijarPosicion({ x: 0, y: 0 });
  }, []);

  const manejar_rueda = useCallback((evento: React.WheelEvent) => {
    evento.preventDefault();
    const delta = evento.deltaY > 0 ? -PASO_ZOOM : PASO_ZOOM;
    fijarZoom((z) => Math.min(Math.max(z + delta, ZOOM_MIN), ZOOM_MAX));
  }, []);

  const manejar_mouse_down = useCallback((evento: React.MouseEvent) => {
    if (zoom <= 1 && !es_modal) return;
    fijarArrastrando(true);
    ultimo_punto_ref.current = { x: evento.clientX, y: evento.clientY };
  }, [zoom, es_modal]);

  const manejar_mouse_move = useCallback((evento: React.MouseEvent) => {
    if (!arrastrando) return;
    const dx = evento.clientX - ultimo_punto_ref.current.x;
    const dy = evento.clientY - ultimo_punto_ref.current.y;
    ultimo_punto_ref.current = { x: evento.clientX, y: evento.clientY };
    fijarPosicion((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, [arrastrando]);

  const manejar_mouse_up = useCallback(() => {
    fijarArrastrando(false);
  }, []);

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Controles de zoom */}
      <Group justify="space-between" mb={4}>
        <Text size="xs" fw={600} c="dimmed">
          PREVISUALIZACION
        </Text>
        <Group gap={4}>
          <Tooltip label="Alejar" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={alejar}
              disabled={!tiene_contenido || zoom <= ZOOM_MIN}
              aria-label="Alejar zoom previsualización"
            >
              <VscZoomOut size={12} />
            </ActionIcon>
          </Tooltip>
          <Text size="xs" c="dimmed" fw={600} style={{ minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Text>
          <Tooltip label="Acercar" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={acercar}
              disabled={!tiene_contenido || zoom >= ZOOM_MAX}
              aria-label="Acercar zoom previsualización"
            >
              <VscZoomIn size={12} />
            </ActionIcon>
          </Tooltip>
          {al_abrir_modal && (
            <Tooltip label="Ver en pantalla completa" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={al_abrir_modal}
                disabled={!tiene_contenido}
                aria-label="Abrir previsualización en modal"
              >
                <VscScreenFull size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {/* Área de previsualización */}
      <Box
        ref={contenedor_ref}
        onWheel={manejar_rueda}
        onMouseDown={manejar_mouse_down}
        onMouseMove={manejar_mouse_move}
        onMouseUp={manejar_mouse_up}
        onMouseLeave={manejar_mouse_up}
        style={{
          flex: 1,
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-sm)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fondo_transparente
            ? 'repeating-conic-gradient(#80808020 0% 25%, transparent 0% 50%) 50% / 16px 16px'
            : color_fondo,
          minHeight: altura_minima,
          cursor: url_preview && tiene_contenido
            ? (arrastrando ? 'grabbing' : (zoom > 1 || es_modal ? 'grab' : 'default'))
            : 'default',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {generando_preview ? (
          <Loader size="sm" />
        ) : url_preview && tiene_contenido ? (
          <img
            src={url_preview}
            alt="Previsualización del diagrama"
            draggable={false}
            style={{
              maxWidth: zoom === 1 && !es_modal ? '100%' : undefined,
              maxHeight: zoom === 1 && !es_modal ? '100%' : undefined,
              objectFit: 'contain',
              transform: `translate(${posicion.x}px, ${posicion.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: arrastrando ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        ) : (
          <Center>
            <Stack align="center" gap="xs">
              <VscFileMedia size={32} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                Sin diagrama para previsualizar
              </Text>
            </Stack>
          </Center>
        )}
      </Box>
    </Box>
  );
}

/**
 * Panel de exportación de imagen con opciones de formato,
 * color de fondo, escala y previsualización con zoom.
 *
 * @param {PropiedadesExportarImagen} props - Propiedades del componente
 * @returns {JSX.Element} Panel de exportación de imagen
 */
export function ExportarImagen({ modelo }: PropiedadesExportarImagen) {
  const { es_oscuro } = UsarTema();
  const [formato, fijarFormato] = useState<FormatoImagen>('png');
  const [fondo_transparente, fijarFondoTransparente] = useState(false);
  const [color_fondo, fijarColorFondo] = useState(es_oscuro ? '#1a1b1e' : '#f8f9fa');
  const [escala, fijarEscala] = useState('2');
  const [url_preview, fijarUrlPreview] = useState<string | null>(null);
  const [exportando, fijarExportando] = useState(false);
  const [generando_preview, fijarGenerandoPreview] = useState(false);
  const [modal_abierto, fijarModalAbierto] = useState(false);
  const temporizador_ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tiene_contenido = modelo !== null && modelo.nodos.length > 0;

  /**
   * Opciones de exportación actuales.
   */
  const opciones_actuales: OpcionesExportarImagen = useMemo(() => ({
    formato,
    color_fondo: fondo_transparente ? null : color_fondo,
    escala: parseInt(escala, 10),
    tema_oscuro: es_oscuro,
  }), [formato, fondo_transparente, color_fondo, escala, es_oscuro]);

  /**
   * Genera la previsualización del diagrama.
   */
  const actualizar_preview = useCallback(async () => {
    if (!modelo || !tiene_contenido) {
      fijarUrlPreview(null);
      return;
    }

    fijarGenerandoPreview(true);
    try {
      const url = await generar_previsualizacion(modelo, opciones_actuales);
      fijarUrlPreview(url);
    } catch {
      fijarUrlPreview(null);
    } finally {
      fijarGenerandoPreview(false);
    }
  }, [modelo, opciones_actuales, tiene_contenido]);

  /**
   * Actualiza la previsualización con debounce al cambiar opciones.
   */
  useEffect(() => {
    if (temporizador_ref.current) {
      clearTimeout(temporizador_ref.current);
    }

    temporizador_ref.current = setTimeout(() => {
      actualizar_preview();
    }, 200);

    return () => {
      if (temporizador_ref.current) {
        clearTimeout(temporizador_ref.current);
      }
    };
  }, [actualizar_preview]);

  /**
   * Descarga la imagen con las opciones actuales.
   */
  const manejar_descargar = useCallback(async () => {
    if (!modelo || !tiene_contenido) return;

    fijarExportando(true);
    try {
      const resultado = await exportar_imagen(modelo, opciones_actuales);
      descargar_blob(resultado.blob, resultado.nombre_archivo);
      URL.revokeObjectURL(resultado.url);
    } catch {
      // Error silencioso - se podría mejorar con notificaciones
    } finally {
      fijarExportando(false);
    }
  }, [modelo, opciones_actuales, tiene_contenido]);

  /**
   * Maneja el cambio de formato.
   */
  const manejar_cambio_formato = useCallback((valor: string | null) => {
    if (valor === 'png' || valor === 'svg' || valor === 'webp') {
      fijarFormato(valor);
    }
  }, []);

  return (
    <>
      <Stack gap="md" p="md" style={{ height: '100%' }}>
        {/* Selector de formato */}
        <Select
          label="Formato de imagen"
          data={[
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WEBP' },
            { value: 'svg', label: 'SVG (bitmap)' },
          ]}
          value={formato}
          onChange={manejar_cambio_formato}
          size="sm"
          allowDeselect={false}
        />

        {/* Escala */}
        <Box>
          <Text size="sm" fw={500} mb={4}>
            Escala
          </Text>
          <SegmentedControl
            value={escala}
            onChange={fijarEscala}
            data={[
              { label: '1x', value: '1' },
              { label: '2x', value: '2' },
              { label: '3x', value: '3' },
            ]}
            size="sm"
            fullWidth
          />
        </Box>

        {/* Color de fondo */}
        <Stack gap="xs">
          <Switch
            label="Fondo transparente"
            checked={fondo_transparente}
            onChange={(evento) => fijarFondoTransparente(evento.currentTarget.checked)}
            size="sm"
          />

          {!fondo_transparente && (
            <ColorInput
              label="Color de fondo"
              value={color_fondo}
              onChange={fijarColorFondo}
              size="sm"
              swatches={[
                '#1a1b1e', '#25262b', '#2c2e33',
                '#ffffff', '#f8f9fa', '#f1f3f5',
                '#228be6', '#1c7ed6', '#1864ab',
              ]}
            />
          )}
        </Stack>

        {/* Previsualización con zoom */}
        <VistaPrevia
          url_preview={url_preview}
          tiene_contenido={tiene_contenido}
          generando_preview={generando_preview}
          fondo_transparente={fondo_transparente}
          color_fondo={color_fondo}
          al_abrir_modal={() => fijarModalAbierto(true)}
          altura_minima={150}
        />

        {/* Botón de descarga */}
        <Button
          fullWidth
          leftSection={<VscDesktopDownload size={16} />}
          onClick={manejar_descargar}
          loading={exportando}
          disabled={!tiene_contenido}
        >
          Descargar {formato.toUpperCase()}
        </Button>
      </Stack>

      {/* Modal de previsualización a pantalla completa */}
      <Modal
        opened={modal_abierto}
        onClose={() => fijarModalAbierto(false)}
        title="Previsualización de imagen"
        size="90vw"
        centered
        styles={{
          body: {
            height: 'calc(80vh - 60px)',
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--mantine-spacing-md)',
          },
          content: {
            maxHeight: '85vh',
          },
        }}
      >
        <VistaPrevia
          url_preview={url_preview}
          tiene_contenido={tiene_contenido}
          generando_preview={generando_preview}
          fondo_transparente={fondo_transparente}
          color_fondo={color_fondo}
          altura_minima={400}
          es_modal
        />
      </Modal>
    </>
  );
}
